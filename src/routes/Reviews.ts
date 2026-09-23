import express from 'express';
const reviewRouter = express.Router();

import { authMiddleware } from '../middleware/Auth-Middleware.js';
import { checkPermission } from '../middleware/Check-Permission.js';
import { validateCSRF } from '../middleware/CSRF.validation.js';

import {
  addReview,
  deleteReviews,
  update,
  getReviews,
} from '../controllers/Reviews-Controller.js';

// Public endpoint to read reviews for a product
reviewRouter.get('/:productId', getReviews);

// Authenticated endpoints to manage reviews
reviewRouter.post(
  '/',
  authMiddleware,
  validateCSRF,
  checkPermission('Review', 'create'),
  addReview
);

reviewRouter.delete(
  '/:productId',
  authMiddleware,
  validateCSRF,
  checkPermission('Review', 'delete'),
  deleteReviews
);

reviewRouter.patch(
  '/:productId',
  authMiddleware,
  validateCSRF,
  checkPermission('Review', 'update'),
  update
);

export { reviewRouter };
export default reviewRouter;
