import express from 'express';
import {
  createAddress,
  getAddresses,
  getDefaultAddress,
  updateAddress,
  deleteAddress,
} from '../controllers/Address-Controller.js';
import { authMiddleware } from '../middleware/Auth-Middleware.js';
import { validateCSRF } from '../middleware/CSRF.validation.js';

const addressRouter = express.Router();

addressRouter.use(authMiddleware);

addressRouter.get('/', getAddresses);
addressRouter.get('/default', getDefaultAddress);
addressRouter.post('/', validateCSRF, createAddress);
addressRouter.patch('/:id', validateCSRF, updateAddress);
addressRouter.delete('/:id', validateCSRF, deleteAddress);

export { addressRouter };
export default addressRouter;
