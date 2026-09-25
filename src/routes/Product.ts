import express from 'express';
const productRouter = express.Router();

import { authMiddleware } from '../middleware/Auth-Middleware.js';
import { checkPermission } from '../middleware/Check-Permission.js';
import { validateCSRF } from '../middleware/CSRF.validation.js';

import {
  addNewProducts,
  getProductById,
  deleteProduct,
  updateProduct,
  getPage,
  searchInProducts,
  getSearchSuggestions,
  getFacets,
  getFeatured,
  hideProduct,
  restoreProduct,
  getHidden,
  getCategories,
  getTags,
} from '../controllers/Product-Controller.js';

// Public Catalog Browsing Endpoints
productRouter.get('/', getPage);
productRouter.get('/page/:page', getPage);
productRouter.get('/search', searchInProducts);
productRouter.post('/search', searchInProducts);
productRouter.get('/search/suggestions', getSearchSuggestions);
productRouter.get('/facets', getFacets);
productRouter.get('/featured', getFeatured);
productRouter.get('/categories', getCategories);
productRouter.get('/tags', getTags);
productRouter.get('/:id', getProductById);

// Admin Product Management
productRouter.post(
  '/',
  authMiddleware,
  validateCSRF,
  checkPermission('Product', 'create'),
  addNewProducts
);

productRouter.patch(
  '/:id',
  authMiddleware,
  validateCSRF,
  checkPermission('Product', 'update'),
  updateProduct
);

productRouter.delete(
  '/:id',
  authMiddleware,
  validateCSRF,
  checkPermission('Product', 'delete'),
  deleteProduct
);

productRouter.patch(
  '/hide/:id',
  authMiddleware,
  validateCSRF,
  checkPermission('Product', 'hide'),
  hideProduct
);

productRouter.patch(
  '/restore/:id',
  authMiddleware,
  validateCSRF,
  checkPermission('Product', 'update'),
  restoreProduct
);

productRouter.get(
  '/admin/hidden',
  authMiddleware,
  validateCSRF,
  checkPermission('Product', 'hide'),
  getHidden
);

export { productRouter };
export default productRouter;
