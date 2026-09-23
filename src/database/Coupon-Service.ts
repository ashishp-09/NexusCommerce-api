import { BadRequestError, NotFoundError } from '../errors/Custom-errors.js';

export interface Coupon {
  code: string;
  discountPercent?: number;
  fixedDiscount?: number;
  minOrderAmount: number;
  maxDiscountAmount?: number;
  expiresAt: Date;
  isActive: boolean;
  usageCount: number;
  maxUsage?: number;
}

// In-memory & dynamic coupon catalog for promotional campaigns
const activeCoupons: Map<string, Coupon> = new Map([
  [
    'WELCOME10',
    {
      code: 'WELCOME10',
      discountPercent: 10,
      minOrderAmount: 20,
      maxDiscountAmount: 50,
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      isActive: true,
      usageCount: 0,
    },
  ],
  [
    'NEXUS20',
    {
      code: 'NEXUS20',
      discountPercent: 20,
      minOrderAmount: 50,
      maxDiscountAmount: 100,
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      isActive: true,
      usageCount: 0,
      maxUsage: 1000,
    },
  ],
  [
    'FLAT15',
    {
      code: 'FLAT15',
      fixedDiscount: 15,
      minOrderAmount: 60,
      expiresAt: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
      isActive: true,
      usageCount: 0,
    },
  ],
]);

class CouponService {
  async validateAndApplyCoupon(code: string, cartTotal: number): Promise<{
    code: string;
    discountAmount: number;
    finalTotal: number;
    description: string;
  }> {
    const formattedCode = code.trim().toUpperCase();
    const coupon = activeCoupons.get(formattedCode);

    if (!coupon || !coupon.isActive) {
      throw new NotFoundError(`Coupon code '${code}' is invalid or expired.`);
    }

    if (new Date() > coupon.expiresAt) {
      throw new BadRequestError(`Coupon code '${code}' has expired.`);
    }

    if (coupon.maxUsage && coupon.usageCount >= coupon.maxUsage) {
      throw new BadRequestError(`Coupon code '${code}' has reached its maximum usage limit.`);
    }

    if (cartTotal < coupon.minOrderAmount) {
      throw new BadRequestError(
        `Coupon '${code}' requires a minimum order amount of $${coupon.minOrderAmount.toFixed(2)} (Current: $${cartTotal.toFixed(2)}).`
      );
    }

    let discountAmount = 0;
    let description = '';

    if (coupon.discountPercent) {
      discountAmount = (cartTotal * coupon.discountPercent) / 100;
      if (coupon.maxDiscountAmount && discountAmount > coupon.maxDiscountAmount) {
        discountAmount = coupon.maxDiscountAmount;
      }
      description = `${coupon.discountPercent}% discount applied (Saved $${discountAmount.toFixed(2)})`;
    } else if (coupon.fixedDiscount) {
      discountAmount = Math.min(coupon.fixedDiscount, cartTotal);
      description = `Flat $${coupon.fixedDiscount} discount applied`;
    }

    const finalTotal = Math.max(0, parseFloat((cartTotal - discountAmount).toFixed(2)));
    coupon.usageCount += 1;

    return {
      code: coupon.code,
      discountAmount: parseFloat(discountAmount.toFixed(2)),
      finalTotal,
      description,
    };
  }

  async listAvailableCoupons(): Promise<Array<Omit<Coupon, 'usageCount'>>> {
    return Array.from(activeCoupons.values())
      .filter((c) => c.isActive && new Date() <= c.expiresAt)
      .map(({ code, discountPercent, fixedDiscount, minOrderAmount, maxDiscountAmount, expiresAt, isActive }) => ({
        code,
        discountPercent,
        fixedDiscount,
        minOrderAmount,
        maxDiscountAmount,
        expiresAt,
        isActive,
      }));
  }
}

const couponService = new CouponService();
export default couponService;
