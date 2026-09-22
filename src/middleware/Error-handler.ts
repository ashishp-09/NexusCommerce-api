import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';

interface ExtendedError extends Error {
  statusCode?: number;
  errorCode?: string;
  isOperational?: boolean;
  stack?: string;
}

const sendDevError = (err: ExtendedError, req: Request, res: Response): void => {
  res.status(err.statusCode || 500).json({
    success: false,
    statusCode: err.statusCode || 500,
    message: err.message || 'Internal Server Error',
    errorCode: err.errorCode || 'SERVER_ERROR',
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString(),
    stack: err.stack,
  });
};

const sendProdError = (err: ExtendedError, req: Request, res: Response): void => {
  if (err.isOperational) {
    res.status(err.statusCode || 500).json({
      success: false,
      statusCode: err.statusCode || 500,
      message: err.message,
      errorCode: err.errorCode || 'OPERATIONAL_ERROR',
      timestamp: new Date().toISOString(),
    });
  } else {
    logger.error('Unhandled Application Exception:', err);
    res.status(500).json({
      success: false,
      statusCode: 500,
      message: 'An unexpected error occurred. Please try again later.',
      errorCode: 'INTERNAL_SERVER_ERROR',
      timestamp: new Date().toISOString(),
    });
  }
};

const errorHandler = (
  err: ExtendedError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): void => {
  err.statusCode = err.statusCode || 500;
  logger.error(
    `[${req.method}] ${req.originalUrl} - Status: ${err.statusCode} - Error: ${err.message} - IP: ${req.ip}`
  );

  if (err.stack && process.env.NODE_ENV === 'development') {
    logger.error(err.stack);
  }

  if (process.env.NODE_ENV === 'development') {
    sendDevError(err, req, res);
  } else {
    sendProdError(err, req, res);
  }
};

export default errorHandler;
