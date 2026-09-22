import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import userService from '../database/User-Service.js';
import { User } from '../schemas/index.js';
import redisClient from '../utils/Get-Redis-Client.js';
import { UnauthorizedError } from '../errors/Custom-errors.js';
import config from '../config/nexus.config.js';

const USER_CACHE_TTL = 1800;

const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
  const token = bearerToken || req.cookies?.jwt || req.cookies?.accessToken;

  if (!token) {
    throw new UnauthorizedError('Authentication token is missing. Please log in.');
  }

  try {
    const secret = process.env.ACCESS_TOKEN_SECRET || config.jwt.accessSecret;
    const decoded = jwt.verify(token, secret, {
      algorithms: ['HS256'],
    }) as { id: string };

    const cacheKey = `user:${decoded.id}`;
    let user: User | null = null;

    try {
      const cachedUser = await redisClient.get(cacheKey);
      if (cachedUser) {
        user = JSON.parse(cachedUser);
      }
    } catch {
      // If redis cache read fails, continue to DB fallback
    }

    if (!user) {
      const foundUser = await userService.findUserById(decoded.id);
      if (!foundUser) {
        throw new UnauthorizedError('User session is invalid or user no longer exists');
      }

      user = {
        ...foundUser,
        role: foundUser.role as import('../schemas/index.js').Role,
        secondEmail:
          foundUser.secondEmail === null ? undefined : foundUser.secondEmail,
      };

      try {
        await redisClient.setEx(cacheKey, USER_CACHE_TTL, JSON.stringify(user));
      } catch {
        // Non-blocking cache write failure
      }
    }

    req.user = user;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      next(new UnauthorizedError('Authentication token has expired. Please refresh your session.'));
    } else if (error instanceof jwt.JsonWebTokenError) {
      next(new UnauthorizedError('Invalid authentication token.'));
    } else {
      next(error);
    }
  }
};

export { authMiddleware };
export default authMiddleware;
