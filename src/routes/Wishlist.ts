import express from 'express';
import {
  addToWishlist,
  removeFromWishlist,
  getWishlist,
  moveToCart,
} from '../controllers/Wishlist-Controller.js';
import { authMiddleware } from '../middleware/Auth-Middleware.js';
import { validateCSRF } from '../middleware/CSRF.validation.js';

const wishlistRouter = express.Router();

wishlistRouter.use(authMiddleware);

wishlistRouter.get('/', getWishlist);
wishlistRouter.post('/', validateCSRF, addToWishlist);
wishlistRouter.delete('/:productId', validateCSRF, removeFromWishlist);
wishlistRouter.post('/:productId/move-to-cart', validateCSRF, moveToCart);

export { wishlistRouter };
export default wishlistRouter;
