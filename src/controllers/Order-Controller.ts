import { Request, Response } from 'express';
import orderService from '../database/Order-Service.js';
import { ApiResponse } from '../utils/api-response.js';
import { User } from '../schemas/index.js';

const createOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user as User;
    if (!user) {
      ApiResponse.error({ res, statusCode: 401, message: 'Unauthorized' });
      return;
    }

    const order = await orderService.createOrder(
      user.id,
      req.body.shippingAddress
    );

    ApiResponse.created({
      res,
      message: 'Order created successfully',
      data: order,
    });
  } catch (error) {
    ApiResponse.error({
      res,
      statusCode: 400,
      message: error instanceof Error ? error.message : 'Failed to create order',
      error,
    });
  }
};

const deleteOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user as User;
    if (!user) {
      ApiResponse.error({ res, statusCode: 401, message: 'Unauthorized' });
      return;
    }

    const order = await orderService.deleteOrder(user.id, req.params.orderId);
    ApiResponse.success({
      res,
      message: 'Order cancelled successfully and stock restored',
      data: order,
    });
  } catch (error) {
    ApiResponse.error({
      res,
      statusCode: 400,
      message: error instanceof Error ? error.message : 'Failed to cancel order',
      error,
    });
  }
};

const getAllOrders = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;

    const result = await orderService.getAllOrders(page, limit);
    ApiResponse.success({
      res,
      message: 'Orders retrieved successfully',
      data: result.orders,
      meta: result.pagination,
    });
  } catch (error) {
    ApiResponse.error({
      res,
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Failed to retrieve orders',
      error,
    });
  }
};

const getOrderUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user as User;
    if (!user) {
      ApiResponse.error({ res, statusCode: 401, message: 'Unauthorized' });
      return;
    }

    const orders = await orderService.getOrderUser(user.id);
    ApiResponse.success({
      res,
      message: 'User orders retrieved successfully',
      data: orders,
    });
  } catch (error) {
    ApiResponse.error({
      res,
      statusCode: 400,
      message: error instanceof Error ? error.message : 'Failed to retrieve orders',
      error,
    });
  }
};

const getOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user as User;
    const isUserAdmin = user && user.role === 'ADMIN';

    const order = await orderService.getOrder(
      req.params.orderId,
      isUserAdmin ? undefined : user?.id
    );

    ApiResponse.success({
      res,
      message: 'Order details retrieved',
      data: order,
    });
  } catch (error) {
    ApiResponse.error({
      res,
      statusCode: 404,
      message: error instanceof Error ? error.message : 'Order not found',
      error,
    });
  }
};

const updateOrderStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status } = req.body;
    if (!status) {
      ApiResponse.error({ res, statusCode: 400, message: 'Order status is required' });
      return;
    }

    const order = await orderService.updateOrderStatus(
      req.params.orderId,
      status
    );

    ApiResponse.success({
      res,
      message: `Order status updated to ${status}`,
      data: order,
    });
  } catch (error) {
    ApiResponse.error({
      res,
      statusCode: 400,
      message: error instanceof Error ? error.message : 'Failed to update order status',
      error,
    });
  }
};

const getAnalytics = async (req: Request, res: Response): Promise<void> => {
  try {
    const analytics = await orderService.getAnalyticsSummary();
    ApiResponse.success({
      res,
      message: 'Sales and order analytics retrieved successfully',
      data: analytics,
    });
  } catch (error) {
    ApiResponse.error({
      res,
      statusCode: 500,
      message: 'Failed to generate analytics summary',
      error,
    });
  }
};

export {
  createOrder,
  deleteOrder,
  getAllOrders,
  getAllOrders as getALlOrder,
  getOrderUser,
  getOrderUser as GetOrderUser,
  getOrder,
  updateOrderStatus,
  getAnalytics,
};
