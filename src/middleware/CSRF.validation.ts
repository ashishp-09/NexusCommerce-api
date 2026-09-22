import { Response, Request, NextFunction } from 'express';
import { timingSafeEqual } from 'crypto';
import { ForbiddenError } from '../errors/Custom-errors.js';

export const validateCSRF = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Skip for safe methods that don't modify state
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Allow Bearer token authenticated API clients (e.g. mobile/postman) to bypass CSRF if explicitly using header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return next();
  }

  const csrfToken = req.headers['x-csrf-token'] || req.headers['x-xsrf-token'];
  const cookieToken = req.cookies?.['XSRF-TOKEN'];

  if (!csrfToken || !cookieToken) {
    next(new ForbiddenError('CSRF token validation failed: Missing token header or cookie'));
    return;
  }

  try {
    const isEqual = timingSafeEqual(
      Buffer.from(cookieToken),
      Buffer.from(String(csrfToken))
    );
    if (!isEqual) {
      throw new Error('Token mismatch');
    }
    next();
  } catch {
    next(new ForbiddenError('CSRF token validation failed: Invalid security token'));
  }
};
