import { Request, Response } from 'express';
import cartService from '../database/Cart-Service.js';
import { ApiResponse } from '../utils/api-response.js';
import { User } from '../schemas/index.js';

const addItem = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user as User;
    if (!user) {
      ApiResponse.error({ res, statusCode: 401, message: 'Unauthorized' });
      return;
    }

    const result = await cartService.addOrCreateCartItem(user.id, req.body);
    ApiResponse.success({
      res,
      message: 'Item added to cart successfully',
      data: result,
    });
  } catch (error) {
    ApiResponse.error({
      res,
      statusCode: 400,
      message: error instanceof Error ? error.message : 'Failed to add item to cart',
      error,
    });
  }
};

const deleteItemFromCart = async (req: Request, res: Response): Promise<void> => {
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

    await cartService.deleteItemFromCart(productId, user.id);
    ApiResponse.success({
      res,
      message: 'Item removed from cart successfully',
      data: { productId },
    });
  } catch (error) {
    ApiResponse.error({
      res,
      statusCode: 400,
      message: error instanceof Error ? error.message : 'Failed to delete item from cart',
      error,
    });
  }
};

const clearCart = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user as User;
    if (!user) {
      ApiResponse.error({ res, statusCode: 401, message: 'Unauthorized' });
      return;
    }

    const result = await cartService.clearCart(user.id);
    ApiResponse.success({
      res,
      message: 'Cart cleared successfully',
      data: result,
    });
  } catch (error) {
    ApiResponse.error({
      res,
      statusCode: 400,
      message: error instanceof Error ? error.message : 'Failed to clear cart',
      error,
    });
  }
};

const getItems = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user as User;
    if (!user) {
      ApiResponse.error({ res, statusCode: 401, message: 'Unauthorized' });
      return;
    }

    const cart = await cartService.getCart(user.id);
    ApiResponse.success({
      res,
      message: 'Cart retrieved successfully',
      data: cart,
    });
  } catch (error) {
    ApiResponse.error({
      res,
      statusCode: 400,
      message: error instanceof Error ? error.message : 'Failed to get cart',
      error,
    });
  }
};

const updateCart = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user as User;
    if (!user) {
      ApiResponse.error({ res, statusCode: 401, message: 'Unauthorized' });
      return;
    }

    const { productId, quantity } = req.body;
    if (!productId || quantity === undefined) {
      ApiResponse.error({
        res,
        statusCode: 400,
        message: 'Product ID and new quantity are required',
      });
      return;
    }

    const updatedItem = await cartService.updateCartItemQuantity(
      productId,
      user.id,
      parseInt(quantity, 10)
    );

    ApiResponse.success({
      res,
      message: 'Cart item quantity updated successfully',
      data: updatedItem,
    });
  } catch (error) {
    ApiResponse.error({
      res,
      statusCode: 400,
      message: error instanceof Error ? error.message : 'Failed to update cart item',
      error,
    });
  }
};

export { addItem, deleteItemFromCart, clearCart, getItems, updateCart };
