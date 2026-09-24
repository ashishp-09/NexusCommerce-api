import express from 'express';
const orderRouter = express.Router();

import { checkPermission } from '../middleware/Check-Permission.js';
import {
  createOrder,
  deleteOrder,
  getAllOrders,
  getOrderUser,
  getOrder,
  updateOrderStatus,
  getAnalytics,
} from '../controllers/Order-Controller.js';

orderRouter.post('/', checkPermission('Order', 'create'), createOrder);
orderRouter.get('/user', checkPermission('Order', 'view'), getOrderUser);
orderRouter.get('/analytics/summary', checkPermission('Order', 'view'), getAnalytics);
orderRouter.get('/', checkPermission('Order', 'view'), getAllOrders);
orderRouter.get('/:orderId', checkPermission('Order', 'view'), getOrder);

orderRouter.delete(
  '/:orderId',
  checkPermission('Order', 'delete'),
  deleteOrder
);

orderRouter.patch(
  '/:orderId/status',
  checkPermission('Order', 'update'),
  updateOrderStatus
);

export { orderRouter };
export default orderRouter;
