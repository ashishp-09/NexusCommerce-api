import { Response } from 'express';

export interface ApiResponseOptions<T> {
  res: Response;
  statusCode?: number;
  message?: string;
  data?: T;
  meta?: Record<string, unknown>;
}

export class ApiResponse {
  static success<T>({
    res,
    statusCode = 200,
    message = 'Success',
    data,
    meta,
  }: ApiResponseOptions<T>): Response {
    return res.status(statusCode).json({
      success: true,
      statusCode,
      message,
      data: data ?? null,
      meta,
      timestamp: new Date().toISOString(),
    });
  }

  static created<T>({
    res,
    message = 'Resource created successfully',
    data,
  }: Omit<ApiResponseOptions<T>, 'statusCode'>): Response {
    return ApiResponse.success({
      res,
      statusCode: 201,
      message,
      data,
    });
  }

  static error({
    res,
    statusCode = 500,
    message = 'Internal Server Error',
    error,
  }: {
    res: Response;
    statusCode?: number;
    message?: string;
    error?: unknown;
  }): Response {
    return res.status(statusCode).json({
      success: false,
      statusCode,
      message,
      error: process.env.NODE_ENV === 'development' ? error : undefined,
      timestamp: new Date().toISOString(),
    });
  }
}
