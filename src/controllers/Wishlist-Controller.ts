import { Request, Response } from 'express';
import wishlistService from '../database/Wishlist-Service.js';
import { ApiResponse } from '../utils/api-response.js';
import { User } from '../schemas/index.js';

export const addToWishlist = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user as User;
    if (!user) {
      ApiResponse.error({ res, statusCode: 401, message: 'Unauthorized' });
      return;
    }

    const { productId } = req.body;
    if (!productId) {
      ApiResponse.error({ res, statusCode: 400, message: 'Product ID is required' });
      return;
    }

    const result = await wishlistService.addToWishlist(user.id, productId);
    ApiResponse.created({
      res,
      message: 'Product added to wishlist',
      data: result,
    });
  } catch (error) {
    ApiResponse.error({
      res,
      statusCode: 400,
      message: error instanceof Error ? error.message : 'Failed to add product to wishlist',
      error,
    });
  }
};

export const removeFromWishlist = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user as User;
    if (!user) {
      ApiResponse.error({ res, statusCode: 401, message: 'Unauthorized' });
      return;
    }

    const { productId } = req.params;
    if (!productId) {
      ApiResponse.error({ res, statusCode: 400, message: 'Product ID is required' });
      return;
    }

    const result = await wishlistService.removeFromWishlist(user.id, productId);
    ApiResponse.success({
      res,
      message: 'Product removed from wishlist',
      data: result,
    });
  } catch (error) {
    ApiResponse.error({
      res,
      statusCode: 400,
      message: error instanceof Error ? error.message : 'Failed to remove from wishlist',
      error,
    });
  }
};

export const getWishlist = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user as User;
    if (!user) {
      ApiResponse.error({ res, statusCode: 401, message: 'Unauthorized' });
      return;
    }

    const wishlist = await wishlistService.getWishlist(user.id);
    ApiResponse.success({
      res,
      message: 'Wishlist retrieved successfully',
      data: wishlist,
    });
  } catch (error) {
    ApiResponse.error({
      res,
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Failed to retrieve wishlist',
      error,
    });
  }
};

export const moveToCart = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user as User;
    if (!user) {
      ApiResponse.error({ res, statusCode: 401, message: 'Unauthorized' });
      return;
    }

    const { productId } = req.params;
    if (!productId) {
      ApiResponse.error({ res, statusCode: 400, message: 'Product ID is required' });
      return;
    }

    const result = await wishlistService.moveToCart(user.id, productId);
    ApiResponse.success({
      res,
      message: 'Product moved to shopping cart',
      data: result,
    });
  } catch (error) {
    ApiResponse.error({
      res,
      statusCode: 400,
      message: error instanceof Error ? error.message : 'Failed to move product to cart',
      error,
    });
  }
};
