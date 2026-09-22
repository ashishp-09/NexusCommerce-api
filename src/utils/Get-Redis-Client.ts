import { createClient } from 'redis';
import { logger } from './logger.js';

const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://redis:6379',
  socket: {
    reconnectStrategy: (retries) => {
      const maxRetries = 20;
      if (retries > maxRetries) {
        logger.error(`Max redis connection retries (${maxRetries}) reached`);
        return new Error('Max redis connection retries reached');
      }
      const delay = Math.min(Math.pow(2, retries) * 100, 10000);
      logger.info(`Redis reconnecting in ${delay}ms (attempt ${retries})`);
      return delay;
    },
    connectTimeout: 30000,
  },
});

redisClient.on('connect', () => logger.info('Redis connecting...'));
redisClient.on('ready', () => logger.info('Redis connected successfully'));
redisClient.on('error', (err) => logger.error('Redis client error:', err));
redisClient.on('end', () => logger.warn('Redis connection closed'));
redisClient.on('reconnecting', () =>
  logger.info('Redis attempting to reconnect')
);

const connectRedis = async () => {
  try {
    await redisClient.connect();
    logger.info('Redis connection established');
  } catch (err) {
    logger.error('Redis initial connection failed:', err);
  }
};

connectRedis();

export default redisClient;
