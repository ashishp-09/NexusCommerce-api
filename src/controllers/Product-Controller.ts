import productsService from '../database/ProductsService.js';
import multer from 'multer';
import { Request, Response } from 'express';
import { productFilterSchema, productSortingSchema } from '../schemas/index.js';
import { ApiResponse } from '../utils/api-response.js';

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

const addNewProducts = [
  upload.single('image'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const imagePath = req.file ? req.file.path : (req.body.imageUrl || '');

      const product = await productsService.createProduct(
        req.body,
        imagePath
      );

      ApiResponse.created({
        res,
        message: `Product "${product.name}" created successfully`,
        data: product,
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'ZodError') {
        ApiResponse.error({
          res,
          statusCode: 400,
          message: 'Invalid product payload',
          error,
        });
      } else if (error instanceof Error && error.name === 'ConflictError') {
        ApiResponse.error({
          res,
          statusCode: 409,
          message: error.message,
          error,
        });
      } else {
        ApiResponse.error({
          res,
          statusCode: 500,
          message: 'Server error while creating product',
          error,
        });
      }
    }
  },
];

const getProductById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!id) {
      ApiResponse.error({ res, statusCode: 400, message: 'Product ID is required' });
      return;
    }

    const product = await productsService.getProductById(id);
    ApiResponse.success({ res, data: product });
  } catch (error) {
    ApiResponse.error({
      res,
      statusCode: 404,
      message: error instanceof Error ? error.message : 'Product not found',
      error,
    });
  }
};

const deleteProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (!id) {
      ApiResponse.error({ res, statusCode: 400, message: 'Product ID is required' });
      return;
    }

    await productsService.deleteProduct(id);
    ApiResponse.success({
      res,
      message: 'Product deleted successfully',
      data: { id },
    });
  } catch (error) {
    ApiResponse.error({
      res,
      statusCode: 400,
      message: error instanceof Error ? error.message : 'Failed to delete product',
      error,
    });
  }
};

const updateProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (!id) {
      ApiResponse.error({ res, statusCode: 400, message: 'Product ID is required' });
      return;
    }

    const updatedProduct = await productsService.updateProduct(id, req.body);
    ApiResponse.success({
      res,
      message: `Product "${updatedProduct.name}" updated successfully`,
      data: updatedProduct,
    });
  } catch (error) {
    ApiResponse.error({
      res,
      statusCode: 400,
      message: error instanceof Error ? error.message : 'Failed to update product',
      error,
    });
  }
};

const getPage = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;

    let filter;
    if (req.query.filter) {
      filter = productFilterSchema.parse(
        typeof req.query.filter === 'string'
          ? JSON.parse(req.query.filter)
          : req.query.filter
      );
    }

    let sorting;
    if (req.query.sort) {
      sorting = productSortingSchema.parse(
        typeof req.query.sort === 'string'
          ? JSON.parse(req.query.sort)
          : req.query.sort
      );
    }

    const result = await productsService.getProductByPage(
      page,
      limit,
      filter,
      sorting
    );

    ApiResponse.success({
      res,
      message: 'Products fetched successfully',
      data: result.products,
      meta: result.pagination,
    });
  } catch (error) {
    ApiResponse.error({
      res,
      statusCode: 500,
      message: 'Server error while fetching products',
      error,
    });
  }
};

const searchInProducts = async (req: Request, res: Response): Promise<void> => {
  try {
    const query = (req.query.q as string) || req.body?.name || '';

    if (!query || typeof query !== 'string') {
      ApiResponse.error({ res, statusCode: 400, message: 'Valid search query is required' });
      return;
    }

    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;
    const result = await productsService.searchProductsByName(query, limit);

    ApiResponse.success({
      res,
      message: `Found ${result.length} matching products`,
      data: result,
      meta: { count: result.length, query },
    });
  } catch (error) {
    ApiResponse.error({
      res,
      statusCode: 500,
      message: 'Server error while searching products',
      error,
    });
  }
};

const getFeatured = async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 8;
    const featured = await productsService.getFeaturedProducts(limit);

    ApiResponse.success({
      res,
      message: 'Featured products retrieved successfully',
      data: featured,
    });
  } catch (error) {
    ApiResponse.error({
      res,
      statusCode: 500,
      message: 'Failed to retrieve featured products',
      error,
    });
  }
};

const hideProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (!id) {
      ApiResponse.error({ res, statusCode: 400, message: 'Product ID is required' });
      return;
    }

    const result = await productsService.hideProduct(id);
    ApiResponse.success({
      res,
      message: `Product "${result.name}" hidden successfully`,
      data: result,
    });
  } catch (error) {
    ApiResponse.error({
      res,
      statusCode: 400,
      message: error instanceof Error ? error.message : 'Failed to hide product',
      error,
    });
  }
};

const restoreProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (!id) {
      ApiResponse.error({ res, statusCode: 400, message: 'Product ID is required' });
      return;
    }

    const result = await productsService.restoreProduct(id);
    ApiResponse.success({
      res,
      message: `Product "${result.name}" restored successfully`,
      data: result,
    });
  } catch (error) {
    ApiResponse.error({
      res,
      statusCode: 400,
      message: error instanceof Error ? error.message : 'Failed to restore product',
      error,
    });
  }
};

const getHidden = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await productsService.getHidden();
    ApiResponse.success({ res, data: result });
  } catch (error) {
    ApiResponse.error({
      res,
      statusCode: 400,
      message: error instanceof Error ? error.message : 'Failed to get hidden products',
      error,
    });
  }
};

const getCategories = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await productsService.getCategories();
    ApiResponse.success({ res, data: result });
  } catch (error) {
    ApiResponse.error({
      res,
      statusCode: 400,
      message: error instanceof Error ? error.message : 'Failed to get categories',
      error,
    });
  }
};

const getTags = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await productsService.getAllTags();
    ApiResponse.success({ res, data: result });
  } catch (error) {
    ApiResponse.error({
      res,
      statusCode: 400,
      message: error instanceof Error ? error.message : 'Failed to get tags',
      error,
    });
  }
};

export {
  addNewProducts,
  getProductById,
  deleteProduct,
  updateProduct,
  getPage,
  searchInProducts,
  getFeatured,
  hideProduct,
  restoreProduct,
  getHidden,
  getCategories,
  getTags,
};
