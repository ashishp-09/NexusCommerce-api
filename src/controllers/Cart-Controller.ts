import { Request, Response } from 'express';
import cartService from '../database/Cart-Service.js';
import { ApiResponse } from '../utils/api-response.js';
import { User } from '../schemas/index.js';

const addItem = async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    if (!user) {
      return ApiResponse.error({ res, statusCode: 401, message: 'Unauthorized' });
    }

    const result = await cartService.addOrCreateCartItem(user.id, req.body);
    return ApiResponse.success({
      res,
      message: 'Item added to cart successfully',
      data: result,
    });
  } catch (error) {
    return ApiResponse.error({
      res,
      statusCode: 400,
      message: error instanceof Error ? error.message : 'Failed to add item to cart',
      error,
    });
  }
};

const deleteItemFromCart = async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    if (!user) {
      return ApiResponse.error({ res, statusCode: 401, message: 'Unauthorized' });
    }

    const { productId } = req.params;
    if (!productId) {
      return ApiResponse.error({ res, statusCode: 400, message: 'Product ID is required' });
    }

    await cartService.deleteItemFromCart(productId, user.id);
    return ApiResponse.success({
      res,
      message: 'Item removed from cart successfully',
      data: { productId },
    });
  } catch (error) {
    return ApiResponse.error({
      res,
      statusCode: 400,
      message: error instanceof Error ? error.message : 'Failed to delete item from cart',
      error,
    });
  }
};

const clearCart = async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    if (!user) {
      return ApiResponse.error({ res, statusCode: 401, message: 'Unauthorized' });
    }

    const result = await cartService.clearCart(user.id);
    return ApiResponse.success({
      res,
      message: 'Cart cleared successfully',
      data: result,
    });
  } catch (error) {
    return ApiResponse.error({
      res,
      statusCode: 400,
      message: error instanceof Error ? error.message : 'Failed to clear cart',
      error,
    });
  }
};

const getItems = async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    if (!user) {
      return ApiResponse.error({ res, statusCode: 401, message: 'Unauthorized' });
    }

    const cart = await cartService.getCart(user.id);
    return ApiResponse.success({
      res,
      message: 'Cart retrieved successfully',
      data: cart,
    });
  } catch (error) {
    return ApiResponse.error({
      res,
      statusCode: 400,
      message: error instanceof Error ? error.message : 'Failed to get cart',
      error,
    });
  }
};

const updateCart = async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    if (!user) {
      return ApiResponse.error({ res, statusCode: 401, message: 'Unauthorized' });
    }

    const { productId, quantity } = req.body;
    if (!productId || quantity === undefined) {
      return ApiResponse.error({
        res,
        statusCode: 400,
        message: 'Product ID and new quantity are required',
      });
    }

    const updatedItem = await cartService.updateCartItemQuantity(
      productId,
      user.id,
      parseInt(quantity, 10)
    );

    return ApiResponse.success({
      res,
      message: 'Cart item quantity updated successfully',
      data: updatedItem,
    });
  } catch (error) {
    return ApiResponse.error({
      res,
      statusCode: 400,
      message: error instanceof Error ? error.message : 'Failed to update cart item',
      error,
    });
  }
};

export { addItem, deleteItemFromCart, clearCart, getItems, updateCart };
