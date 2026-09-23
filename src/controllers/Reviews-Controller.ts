import { Request, Response } from 'express';
import { reviews } from '../schemas/index.js';
import reviewsService from '../database/Review-Service.js';
import { ApiResponse } from '../utils/api-response.js';

const addReview = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      ApiResponse.error({ res, statusCode: 401, message: 'Unauthorized' });
      return;
    }

    const userId = (req.user as { id: string }).id;

    const data: reviews = {
      userId,
      productId: req.body.productId,
      rating: parseFloat(req.body.rating),
      comment: req.body.comment,
    };

    const review = await reviewsService.addReview(data);
    ApiResponse.created({
      res,
      message: 'Review posted successfully',
      data: review,
    });
  } catch (error) {
    ApiResponse.error({
      res,
      statusCode: 400,
      message: error instanceof Error ? error.message : 'Failed to post review',
      error,
    });
  }
};

const update = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user;

    if (!user) {
      ApiResponse.error({ res, statusCode: 401, message: 'Unauthorized' });
      return;
    }

    const userId = (req.user as { id: string }).id;
    const productId = req.params.productId;

    const updateFields: Partial<Pick<reviews, 'rating' | 'comment'>> = {};
    if (req.body.rating !== undefined) updateFields.rating = parseFloat(req.body.rating);
    if (req.body.comment !== undefined) updateFields.comment = req.body.comment;

    if (Object.keys(updateFields).length === 0) {
      ApiResponse.error({
        res,
        statusCode: 400,
        message: 'Provide at least rating or comment to update',
      });
      return;
    }

    const data = {
      userId,
      productId,
      ...updateFields,
    };

    const review = await reviewsService.updateReview(data);

    ApiResponse.success({
      res,
      message: 'Review updated successfully',
      data: review,
    });
  } catch (error) {
    ApiResponse.error({
      res,
      statusCode: 400,
      message: error instanceof Error ? error.message : 'Failed to update review',
      error,
    });
  }
};

const deleteReviews = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user;

    if (!user) {
      ApiResponse.error({ res, statusCode: 401, message: 'Unauthorized' });
      return;
    }

    const userId = (req.user as { id: string }).id;
    const productId = req.params.productId;

    if (!productId) {
      ApiResponse.error({ res, statusCode: 400, message: 'Missing product ID' });
      return;
    }

    await reviewsService.deleteReviews({ userId, productId });
    ApiResponse.success({ res, message: 'Review deleted successfully' });
  } catch (error) {
    ApiResponse.error({
      res,
      statusCode: 400,
      message: error instanceof Error ? error.message : 'Failed to delete review',
      error,
    });
  }
};

const getReviews = async (req: Request, res: Response) => {
  try {
    const productId = req.params.productId;
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;

    const data = await reviewsService.getReviews(productId, page, limit);
    ApiResponse.success({
      res,
      message: 'Reviews retrieved successfully',
      data: data.reviews,
      meta: {
        totalCount: data.totalCount,
        page: data.page,
        limit: data.limit,
        totalPages: data.totalPages,
      },
    });
  } catch (error) {
    ApiResponse.error({
      res,
      statusCode: 404,
      message: error instanceof Error ? error.message : 'Failed to retrieve reviews',
      error,
    });
  }
};

export { addReview, update, deleteReviews, getReviews };
