import express from 'express';
const paymentRouter = express.Router();

import { authMiddleware } from '../middleware/Auth-Middleware.js';
import { checkPermission } from '../middleware/Check-Permission.js';
import { validateCSRF } from '../middleware/CSRF.validation.js';

import {
  getPublishableKey,
  webhook,
  payment,
} from '../controllers/Payments-Controller.js';

paymentRouter.get('/key', authMiddleware, getPublishableKey);
paymentRouter.get('/', authMiddleware, getPublishableKey);

// Webhook endpoint (must receive raw body from Stripe)
paymentRouter.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  webhook
);

// Checkout session creation
paymentRouter.post(
  '/checkout',
  authMiddleware,
  validateCSRF,
  checkPermission('Payment', 'view'),
  payment
);

paymentRouter.post(
  '/',
  authMiddleware,
  validateCSRF,
  checkPermission('Payment', 'view'),
  payment
);

export { paymentRouter };
export default paymentRouter;
