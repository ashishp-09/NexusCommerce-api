import { Response } from 'express';
import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
import { User, RefreshToken } from '../schemas/index.js';
import userService from '../database/User-Service.js';
import { AppError, UnauthorizedError } from '../errors/Custom-errors.js';
import { logger } from './logger.js';
import config from '../config/nexus.config.js';

export const generateCSRFToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

export const attachCookiesToResponse = async (res: Response, user: User) => {
  const accessSecret = process.env.ACCESS_TOKEN_SECRET || config.jwt.accessSecret;
  const refreshSecret = process.env.REFRESH_TOKEN_SECRET || config.jwt.refreshSecret;

  if (!accessSecret || !refreshSecret) {
    logger.error('JWT configuration missing access or refresh secret');
    throw new AppError(
      'Server authentication configuration error',
      500,
      'SERVER_CONFIG_ERROR'
    );
  }

  const accessToken = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    accessSecret,
    { expiresIn: '15m' }
  );

  const refreshToken = jwt.sign(
    { id: user.id },
    refreshSecret,
    { expiresIn: '7d' }
  );

  const csrfToken = generateCSRFToken();

  res.cookie('jwt', accessToken, {
    httpOnly: true,
    maxAge: 15 * 60 * 1000,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });

  res.cookie('XSRF-TOKEN', csrfToken, {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 15 * 60 * 1000,
    sameSite: 'lax',
  });

  const token: RefreshToken = {
    token: refreshToken,
    userId: String(user.id),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  };

  await userService.refreshToken(token).catch((err) => {
    logger.error('Failed to store refresh token in database:', err);
  });

  return {
    csrfToken,
    accessToken,
    refreshToken,
  };
};

export const forgot = (code: string, email?: string) => {
  const secret = process.env.FORGOT_TOKEN_SECRET || config.jwt.accessSecret;

  return jwt.sign({ code, email }, secret, {
    expiresIn: '1h',
  });
};

type ForgotPayload = { code: string; email?: string };

export const verifyJWT = (token: string): ForgotPayload | null => {
  if (!token) {
    throw new UnauthorizedError('Authentication token is missing');
  }

  const secret = process.env.FORGOT_TOKEN_SECRET || config.jwt.accessSecret;

  try {
    return jwt.verify(token, secret) as ForgotPayload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      logger.warn(`JWT expired: ${error.message}`);
      throw new UnauthorizedError('Authentication token has expired');
    } else if (error instanceof jwt.JsonWebTokenError) {
      logger.warn(`JWT invalid: ${error.message}`);
      throw new UnauthorizedError('Invalid authentication token');
    } else {
      logger.error(`JWT verification failed with unexpected error: ${error}`);
      throw new AppError('Authentication failed', 500, 'AUTH_ERROR');
    }
  }
};
