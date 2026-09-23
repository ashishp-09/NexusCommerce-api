import express from 'express';
import { applyCoupon, listCoupons } from '../controllers/Coupon-Controller.js';
import { authMiddleware } from '../middleware/Auth-Middleware.js';
import { validateCSRF } from '../middleware/CSRF.validation.js';

const couponRouter = express.Router();

couponRouter.get('/', listCoupons);
couponRouter.post('/apply', authMiddleware, validateCSRF, applyCoupon);

export { couponRouter };
export default couponRouter;
