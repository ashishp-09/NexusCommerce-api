import express from 'express';
import {
  getLowStock,
  restockProduct,
  bulkRestock,
} from '../controllers/Inventory-Controller.js';
import { authMiddleware } from '../middleware/Auth-Middleware.js';
import { checkPermission } from '../middleware/Check-Permission.js';
import { validateCSRF } from '../middleware/CSRF.validation.js';

const inventoryRouter = express.Router();

inventoryRouter.use(authMiddleware);

// Admin-only Inventory Control
inventoryRouter.get(
  '/low-stock',
  checkPermission('Product', 'view'),
  getLowStock
);

inventoryRouter.patch(
  '/restock',
  validateCSRF,
  checkPermission('Product', 'update'),
  restockProduct
);

inventoryRouter.patch(
  '/bulk-restock',
  validateCSRF,
  checkPermission('Product', 'update'),
  bulkRestock
);

export { inventoryRouter };
export default inventoryRouter;
