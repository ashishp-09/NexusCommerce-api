import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import redisClient from '../utils/Get-Redis-Client.js';
import { ApiResponse } from '../utils/api-response.js';

const healthRouter = express.Router();
const prisma = new PrismaClient();

healthRouter.get('/', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'online',
    service: 'NexusCommerce API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: `${Math.floor(process.uptime())}s`,
  });
});

healthRouter.get('/detailed', async (req: Request, res: Response): Promise<void> => {
  const startTime = Date.now();
  let dbStatus = 'healthy';
  let dbLatencyMs = 0;
  let redisStatus = 'healthy';
  let redisLatencyMs = 0;

  // Test Database connectivity
  try {
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    dbLatencyMs = Date.now() - dbStart;
  } catch {
    dbStatus = 'degraded';
  }

  // Test Redis connectivity
  try {
    const redisStart = Date.now();
    await redisClient.ping();
    redisLatencyMs = Date.now() - redisStart;
  } catch {
    redisStatus = 'degraded';
  }

  const memoryUsage = process.memoryUsage();

  ApiResponse.success({
    res,
    message: 'System diagnostics collected successfully',
    data: {
      status: dbStatus === 'healthy' && redisStatus === 'healthy' ? 'operational' : 'degraded',
      environment: process.env.NODE_ENV || 'development',
      nodeVersion: process.version,
      uptimeSeconds: Math.floor(process.uptime()),
      totalLatencyMs: Date.now() - startTime,
      services: {
        database: {
          status: dbStatus,
          latencyMs: dbLatencyMs,
        },
        redis: {
          status: redisStatus,
          latencyMs: redisLatencyMs,
        },
      },
      system: {
        rssMb: (memoryUsage.rss / (1024 * 1024)).toFixed(2),
        heapUsedMb: (memoryUsage.heapUsed / (1024 * 1024)).toFixed(2),
        heapTotalMb: (memoryUsage.heapTotal / (1024 * 1024)).toFixed(2),
      },
    },
  });
});

export { healthRouter };
export default healthRouter;
