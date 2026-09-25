import { PrismaClient } from '@prisma/client';
import { NotFoundError, ConflictError } from '../errors/Custom-errors.js';
import cartService from './Cart-Service.js';

const prisma = new PrismaClient();

// In-memory persistent fallback store for user wishlists
const userWishlists: Map<string, Set<string>> = new Map();

class WishlistService {
  constructor(private readonly prisma: PrismaClient) {}

  async addToWishlist(userId: string, productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId, isDeleted: false },
    });

    if (!product) {
      throw new NotFoundError('Product not found or has been removed');
    }

    if (!userWishlists.has(userId)) {
      userWishlists.set(userId, new Set());
    }

    const userSet = userWishlists.get(userId)!;
    if (userSet.has(productId)) {
      throw new ConflictError('Product already exists in your wishlist');
    }

    userSet.add(productId);

    return {
      userId,
      product,
      addedAt: new Date().toISOString(),
    };
  }

  async removeFromWishlist(userId: string, productId: string) {
    const userSet = userWishlists.get(userId);
    if (!userSet || !userSet.has(productId)) {
      throw new NotFoundError('Product not found in your wishlist');
    }

    userSet.delete(productId);
    return { productId, removed: true };
  }

  async getWishlist(userId: string) {
    const userSet = userWishlists.get(userId) || new Set();
    const productIds = Array.from(userSet);

    if (productIds.length === 0) {
      return {
        userId,
        items: [],
        totalItems: 0,
      };
    }

    const products = await this.prisma.product.findMany({
      where: {
        id: { in: productIds },
        isDeleted: false,
      },
    });

    return {
      userId,
      items: products,
      totalItems: products.length,
    };
  }

  async moveToCart(userId: string, productId: string) {
    await this.removeFromWishlist(userId, productId);

    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundError('Product not found');
    }

    await cartService.addOrCreateCartItem(userId, {
      productId,
      quantity: 1,
      price: Number(product.price),
    });

    return {
      message: `Product "${product.name}" moved from wishlist to cart`,
      productId,
    };
  }
}

const wishlistService = new WishlistService(prisma);
export default wishlistService;
