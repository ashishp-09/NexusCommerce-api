import express from 'express';
import passport from 'passport';

const authRouter = express.Router();

import {
  register,
  verifyEmail,
  login,
  loginWithGoogle,
  resetPassword,
  forgotPassword,
  logout,
  refresh,
  addsecondEmail,
  Reqest2fa,
  verify2FA,
} from '../controllers/authControllers/Auth-Controllers.js';
import { authMiddleware } from '../middleware/Auth-Middleware.js';
import { validateCSRF } from '../middleware/CSRF.validation.js';

authRouter.post('/2fa/email/request', authMiddleware, validateCSRF, Reqest2fa);
authRouter.post('/2fa/email/verify', authMiddleware, validateCSRF, verify2FA);
authRouter.post('/2fa/addEmail', authMiddleware, validateCSRF, addsecondEmail);

authRouter.get(
  '/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

authRouter.get(
  '/google/redirect',
  passport.authenticate('google', { session: false }),
  loginWithGoogle
);

authRouter.post('/register', register);
authRouter.post('/login', login);
authRouter.get('/verify-email', verifyEmail);
authRouter.post('/reset-password', resetPassword);
authRouter.post('/forgot-password', forgotPassword);

authRouter.post('/logout', authMiddleware, validateCSRF, logout);
authRouter.post('/refresh', refresh);

export { authRouter };
export default authRouter;
