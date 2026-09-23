import { Request, Response } from 'express';
import couponService from '../database/Coupon-Service.js';
import cartService from '../database/Cart-Service.js';
import { ApiResponse } from '../utils/api-response.js';
import { User } from '../schemas/index.js';

export const applyCoupon = async (req: Request, res: Response): Promise<void> => {
  try {
    const { code } = req.body;
    const user = req.user as User;

    if (!code || typeof code !== 'string') {
      ApiResponse.error({ res, statusCode: 400, message: 'Promo code is required' });
      return;
    }

    const cart = await cartService.getCart(user.id);
    if (!cart || cart.items.length === 0) {
      ApiResponse.error({ res, statusCode: 400, message: 'Cannot apply coupon to an empty cart' });
      return;
    }

    const cartTotal = cart.items.reduce(
      (sum, item) => sum + Number(item.price) * item.quantity,
      0
    );

    const result = await couponService.validateAndApplyCoupon(code, cartTotal);

    ApiResponse.success({
      res,
      message: 'Coupon applied successfully',
      data: {
        ...result,
        originalTotal: cartTotal,
      },
    });
  } catch (error) {
    ApiResponse.error({
      res,
      statusCode: 400,
      message: error instanceof Error ? error.message : 'Failed to apply coupon',
      error,
    });
  }
};

export const listCoupons = async (req: Request, res: Response): Promise<void> => {
  try {
    const coupons = await couponService.listAvailableCoupons();
    ApiResponse.success({
      res,
      message: 'Active promotions and coupons retrieved',
      data: coupons,
    });
  } catch (error) {
    ApiResponse.error({
      res,
      statusCode: 500,
      message: 'Failed to retrieve coupon promotions',
      error,
    });
  }
};
