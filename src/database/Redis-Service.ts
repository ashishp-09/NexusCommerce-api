import redisClient from '../utils/Get-Redis-Client.js';
import { logger } from '../utils/logger.js';
import config from '../config/nexus.config.js';

class RedisService {
  private defaultTtl: number = config.redis.defaultTtl || 3600;

  async getOrSetCache<T>(
    key: string,
    callback: () => Promise<T>,
    ttlSeconds: number = this.defaultTtl
  ): Promise<T> {
    try {
      const cached = await redisClient.get(key);
      if (cached) {
        return JSON.parse(cached) as T;
      }
    } catch (err) {
      logger.warn(`Redis cache get error for key "${key}":`, err);
    }

    const freshData = await callback();

    if (freshData !== undefined && freshData !== null) {
      try {
        await redisClient.setEx(key, ttlSeconds, JSON.stringify(freshData));
      } catch (err) {
        logger.warn(`Redis cache set error for key "${key}":`, err);
      }
    }

    return freshData;
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const cached = await redisClient.get(key);
      return cached ? (JSON.parse(cached) as T) : null;
    } catch (err) {
      logger.warn(`Redis get failed for key "${key}":`, err);
      return null;
    }
  }

  async set<T>(key: string, data: T, ttlSeconds: number = this.defaultTtl): Promise<void> {
    try {
      await redisClient.setEx(key, ttlSeconds, JSON.stringify(data));
    } catch (err) {
      logger.warn(`Redis set failed for key "${key}":`, err);
    }
  }

  async del(key: string): Promise<void> {
    try {
      await redisClient.del(key);
    } catch (err) {
      logger.warn(`Redis del failed for key "${key}":`, err);
    }
  }

  async invalidateByPattern(pattern: string): Promise<void> {
    try {
      const keys = await redisClient.keys(pattern);
      if (keys.length > 0) {
        await redisClient.del(keys);
        logger.info(`Invalidated ${keys.length} cache keys matching pattern: ${pattern}`);
      }
    } catch (err) {
      logger.warn(`Redis pattern invalidation failed for "${pattern}":`, err);
    }
  }

  async clearProductCache(): Promise<void> {
    await this.invalidateByPattern('products:*');
  }
}

const redisService = new RedisService();
export default redisService;
