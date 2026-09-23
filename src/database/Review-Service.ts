import { PrismaClient } from '@prisma/client';
import { ZodError } from 'zod';

import { reviewsSchema, reviews } from '../schemas/index.js';
import { logger } from '../utils/logger.js';
import {
  AppError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../errors/Custom-errors.js';
import redisService from './Redis-Service.js';

const prisma = new PrismaClient();

class ReviewsService {
  constructor(private readonly prisma: PrismaClient) {}

  async calculateRating(productId: string) {
    try {
      await this.prisma.$transaction(async (tx) => {
        const avgResult = await tx.review.aggregate({
          _avg: {
            rating: true,
          },
          _count: {
            id: true,
          },
          where: {
            productId,
          },
        });

        await tx.product.update({
          where: { id: productId },
          data: {
            rating: avgResult._avg.rating ?? 0,
          },
        });
      });

      await redisService.clearProductCache();
    } catch (error) {
      logger.error(
        `Failed to calculate rating for product ${productId}: ${error}`
      );
      throw new AppError(
        'Failed to update product rating',
        500,
        'RATING_CALCULATION_FAILED'
      );
    }
  }

  async addReview(data: reviews) {
    try {
      const validData = reviewsSchema.parse(data);

      const existingReview = await this.prisma.review.findUnique({
        where: {
          userId_productId: {
            userId: validData.userId!,
            productId: validData.productId!,
          },
        },
      });

      if (existingReview) {
        throw new ConflictError(
          'Review already exists for this product from your account'
        );
      }

      const rev = await this.prisma.review.create({
        data: {
          ...validData,
          userId: validData.userId!,
          productId: validData.productId!,
        },
      });
      await this.calculateRating(validData.productId!);

      logger.info(
        `Review added for product ${validData.productId} by user ${validData.userId}`
      );
      return rev;
    } catch (error) {
      if (error instanceof ConflictError) {
        throw error;
      }

      logger.error(`Error adding review: ${error}`);

      if (error instanceof ZodError) {
        throw new ValidationError('Invalid review data');
      }

      throw new AppError('Failed to add review', 500, 'REVIEW_ADD_FAILED');
    }
  }

  async updateReview(
    data: Partial<reviews> & { userId: string; productId: string }
  ) {
    try {
      const updateSchema = reviewsSchema.partial({
        rating: true,
        comment: true,
      });

      const validUpdateFields = updateSchema.parse(data);
      const { userId, productId, ...updateFields } = validUpdateFields;

      const rev = await this.prisma.review.update({
        where: {
          userId_productId: {
            userId: userId!,
            productId: productId!,
          },
        },
        data: updateFields,
      });

      await this.calculateRating(productId!);
      return rev;
    } catch (error) {
      throw new ValidationError('Invalid review data');
    }
  }

  async deleteReviews(data: Record<string, string> = {}) {
    try {
      const deleted = await this.prisma.review.delete({
        where: {
          userId_productId: {
            userId: data.userId!,
            productId: data.productId!,
          },
        },
      });

      if (data.productId) {
        await this.calculateRating(data.productId);
      }

      return deleted;
    } catch (error) {
      throw new ValidationError('Invalid review data or review not found');
    }
  }

  async getReviews(productId: string, page: number = 1, limit: number = 10) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundError('Product not found');
    }

    const [reviewsList, totalCount] = await Promise.all([
      this.prisma.review.findMany({
        where: { productId },
        include: {
          user: {
            select: { id: true, username: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.review.count({ where: { productId } }),
    ]);

    return {
      reviews: reviewsList,
      totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit),
    };
  }
}

const reviewsService = new ReviewsService(prisma);
export default reviewsService;
