import { PrismaClient, Prisma } from '@prisma/client';
import { productSchema, Product } from '../schemas/index.js';
import redisService from './Redis-Service.js';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../errors/Custom-errors.js';

const prisma = new PrismaClient();

export type ProductFilter = {
  name?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  category?: string;
  tags?: string[];
  minRating?: number;
};

export type ProductSorting = {
  field: 'name' | 'price' | 'createdAt' | 'rating' | 'category';
  order: 'asc' | 'desc';
};

class ProductsService {
  constructor(private readonly prisma: PrismaClient) {}

  async createProduct(data: unknown, imageUrl: string) {
    const validData = productSchema.parse({
      ...(data as object),
      imageUrl,
    });

    const result = await this.prisma.$transaction(async (tx) => {
      const existingProduct = await tx.product.findFirst({
        where: {
          name: { equals: validData.name, mode: 'insensitive' },
          isDeleted: false,
        },
      });

      if (existingProduct) {
        throw new ConflictError(`Product "${validData.name}" already exists`);
      }

      return tx.product.create({
        data: {
          ...validData,
          imageUrl: validData.imageUrl || '',
          isDeleted: false,
        },
      });
    });

    await redisService.clearProductCache();
    return result;
  }

  async deleteProduct(id: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { id },
      });

      if (!product) {
        throw new NotFoundError(`Product with ID ${id} not found`);
      }

      return tx.product.delete({
        where: { id },
      });
    });

    await redisService.clearProductCache();
    return result;
  }

  async updateProduct(id: string, data: Partial<Product>) {
    const result = await this.prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { id },
      });

      if (!product) {
        throw new NotFoundError(`Product with ID ${id} not found`);
      }

      if (product.isDeleted) {
        throw new ForbiddenError('Cannot update a deleted product');
      }

      return tx.product.update({
        where: { id },
        data: { ...data },
      });
    });

    await redisService.clearProductCache();
    return result;
  }

  async getProductById(id: string) {
    const cacheKey = `products:item:${id}`;
    return redisService.getOrSetCache(cacheKey, async () => {
      const product = await this.prisma.product.findUnique({
        where: { id, isDeleted: false },
        include: {
          reviews: {
            take: 5,
            orderBy: { createdAt: 'desc' },
            include: {
              user: {
                select: { id: true, username: true },
              },
            },
          },
        },
      });

      if (!product) {
        throw new NotFoundError(`Product with ID ${id} not found`);
      }

      return product;
    }, 1800);
  }

  async getProductByPage(
    page: number = 1,
    limit: number = 20,
    filter?: ProductFilter,
    sorting?: ProductSorting
  ) {
    const cacheKey = `products:page:${page}:limit:${limit}:${JSON.stringify(
      filter
    )}:${JSON.stringify(sorting)}`;

    return redisService.getOrSetCache(cacheKey, async () => {
      const where: Prisma.ProductWhereInput = {
        isDeleted: false,
      };

      if (filter) {
        if (filter.name) {
          where.name = {
            contains: filter.name,
            mode: 'insensitive',
          };
        }

        if (filter.minPrice !== undefined || filter.maxPrice !== undefined) {
          where.price = {};

          if (filter.minPrice !== undefined) {
            where.price.gte = filter.minPrice;
          }

          if (filter.maxPrice !== undefined) {
            where.price.lte = filter.maxPrice;
          }
        }

        if (filter.minRating !== undefined) {
          where.rating = {
            gte: filter.minRating,
          };
        }

        if (filter.inStock !== undefined) {
          where.stock = filter.inStock ? { gt: 0 } : { equals: 0 };
        }

        if (filter.category) {
          where.category = {
            equals: filter.category,
            mode: 'insensitive',
          };
        }

        if (filter.tags && filter.tags.length > 0) {
          where.tags = {
            hasSome: filter.tags,
          };
        }
      }

      const orderBy: Prisma.ProductOrderByWithRelationInput = sorting
        ? { [sorting.field]: sorting.order }
        : { createdAt: 'desc' };

      const [products, totalCount] = await Promise.all([
        this.prisma.product.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy,
        }),
        this.prisma.product.count({ where }),
      ]);

      return {
        products,
        pagination: {
          total: totalCount,
          page,
          limit,
          totalPages: Math.ceil(totalCount / limit),
          hasNext: page * limit < totalCount,
          hasPrev: page > 1,
        },
      };
    }, 900);
  }

  async searchProductsByName(query: string, limit: number = 10) {
    const key = `products:search:${query}:${limit}`;
    return redisService.getOrSetCache(key, async () => {
      return this.prisma.product.findMany({
        where: {
          isDeleted: false,
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } },
            { category: { contains: query, mode: 'insensitive' } },
          ],
        },
        take: limit,
        orderBy: { rating: 'desc' },
      });
    }, 600);
  }

  async getSearchSuggestions(query: string, limit: number = 5) {
    const key = `products:suggestions:${query}:${limit}`;
    return redisService.getOrSetCache(key, async () => {
      const matches = await this.prisma.product.findMany({
        where: {
          isDeleted: false,
          name: { contains: query, mode: 'insensitive' },
        },
        select: {
          id: true,
          name: true,
          price: true,
          category: true,
          imageUrl: true,
        },
        take: limit,
      });

      return matches;
    }, 300);
  }

  async getCatalogFacets() {
    const key = 'products:catalog:facets';
    return redisService.getOrSetCache(key, async () => {
      const [categories, priceAgg] = await Promise.all([
        this.prisma.product.groupBy({
          by: ['category'],
          where: { isDeleted: false },
          _count: { id: true },
        }),
        this.prisma.product.aggregate({
          where: { isDeleted: false },
          _min: { price: true },
          _max: { price: true },
          _avg: { price: true },
        }),
      ]);

      return {
        categories: categories.map((c) => ({
          name: c.category,
          count: c._count.id,
        })),
        priceRange: {
          min: priceAgg._min.price ? Number(priceAgg._min.price) : 0,
          max: priceAgg._max.price ? Number(priceAgg._max.price) : 0,
          avg: priceAgg._avg.price ? Number(priceAgg._avg.price) : 0,
        },
      };
    }, 1800);
  }

  async getFeaturedProducts(limit: number = 8) {
    const key = `products:featured:${limit}`;
    return redisService.getOrSetCache(key, async () => {
      return this.prisma.product.findMany({
        where: {
          isDeleted: false,
          stock: { gt: 0 },
        },
        orderBy: [
          { rating: 'desc' },
          { createdAt: 'desc' },
        ],
        take: limit,
      });
    }, 1800);
  }

  async hideProduct(id: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { id },
      });

      if (!product) {
        throw new NotFoundError(`Product with ID ${id} not found`);
      }

      if (product.isDeleted) {
        throw new ForbiddenError('Product is already hidden');
      }

      return tx.product.update({
        where: { id },
        data: { isDeleted: true },
      });
    });

    await redisService.clearProductCache();
    return result;
  }

  async restoreProduct(id: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { id },
      });

      if (!product) {
        throw new NotFoundError(`Product with ID ${id} not found`);
      }

      if (!product.isDeleted) {
        throw new ForbiddenError('Product is not deleted');
      }

      return tx.product.update({
        where: { id },
        data: { isDeleted: false },
      });
    });

    await redisService.clearProductCache();
    return result;
  }

  async getHidden() {
    return await this.prisma.product.findMany({
      where: { isDeleted: true },
    });
  }

  async getCategories() {
    const key = 'products:categories';
    return redisService.getOrSetCache(key, async () => {
      const categories = await this.prisma.product.findMany({
        where: { isDeleted: false },
        select: { category: true },
        distinct: ['category'],
      });
      return categories.map((c) => c.category);
    }, 3600);
  }

  async getAllTags() {
    const key = 'products:tags';
    return redisService.getOrSetCache(key, async () => {
      const products = await this.prisma.product.findMany({
        where: { isDeleted: false },
        select: { tags: true },
      });

      const allTags = products.flatMap((product) => product.tags);
      return [...new Set(allTags)];
    }, 3600);
  }
}

const productsService = new ProductsService(prisma);
export default productsService;
