import { Request, Response } from 'express';
import inventoryService from '../database/Inventory-Service.js';
import { ApiResponse } from '../utils/api-response.js';

export const getLowStock = async (req: Request, res: Response): Promise<void> => {
  try {
    const threshold = req.query.threshold ? parseInt(req.query.threshold as string, 10) : 5;
    const result = await inventoryService.getLowStockProducts(threshold);

    ApiResponse.success({
      res,
      message: 'Low stock inventory alert retrieved',
      data: result,
    });
  } catch (error) {
    ApiResponse.error({
      res,
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Failed to retrieve inventory alert',
      error,
    });
  }
};

export const restockProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const { productId, quantity } = req.body;
    if (!productId || quantity === undefined) {
      ApiResponse.error({ res, statusCode: 400, message: 'Product ID and quantity are required' });
      return;
    }

    const result = await inventoryService.restockProduct(productId, parseInt(quantity, 10));
    ApiResponse.success({
      res,
      message: `Product "${result.name}" restocked (+${result.addedQuantity})`,
      data: result,
    });
  } catch (error) {
    ApiResponse.error({
      res,
      statusCode: 400,
      message: error instanceof Error ? error.message : 'Restock failed',
      error,
    });
  }
};

export const bulkRestock = async (req: Request, res: Response): Promise<void> => {
  try {
    const { items } = req.body;
    if (!items || !Array.isArray(items)) {
      ApiResponse.error({ res, statusCode: 400, message: 'Invalid items array for bulk restock' });
      return;
    }

    const results = await inventoryService.bulkRestock(items);
    ApiResponse.success({
      res,
      message: `Successfully restocked ${results.length} products`,
      data: results,
    });
  } catch (error) {
    ApiResponse.error({
      res,
      statusCode: 400,
      message: error instanceof Error ? error.message : 'Bulk restock failed',
      error,
    });
  }
};
