import { PrismaClient } from '@prisma/client';
import { NotFoundError, BadRequestError } from '../errors/Custom-errors.js';
import redisService from './Redis-Service.js';

const prisma = new PrismaClient();

class InventoryService {
  constructor(private readonly prisma: PrismaClient) {}

  async getLowStockProducts(threshold: number = 5) {
    const products = await this.prisma.product.findMany({
      where: {
        isDeleted: false,
        stock: { lte: threshold },
      },
      orderBy: { stock: 'asc' },
    });

    return {
      threshold,
      lowStockCount: products.length,
      products,
    };
  }

  async restockProduct(productId: string, quantityToAdd: number) {
    if (quantityToAdd <= 0) {
      throw new BadRequestError('Restock quantity must be greater than 0');
    }

    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundError('Product not found');
    }

    const updated = await this.prisma.product.update({
      where: { id: productId },
      data: {
        stock: { increment: quantityToAdd },
      },
    });

    await redisService.clearProductCache();

    return {
      productId: updated.id,
      name: updated.name,
      previousStock: product.stock,
      addedQuantity: quantityToAdd,
      currentStock: updated.stock,
    };
  }

  async bulkRestock(items: Array<{ productId: string; quantity: number }>) {
    if (!items || items.length === 0) {
      throw new BadRequestError('Items array is required for bulk restock');
    }

    const results = await this.prisma.$transaction(async (tx) => {
      const updatedList = [];

      for (const item of items) {
        if (item.quantity > 0) {
          const updated = await tx.product.update({
            where: { id: item.productId },
            data: { stock: { increment: item.quantity } },
          });
          updatedList.push({
            productId: updated.id,
            name: updated.name,
            currentStock: updated.stock,
          });
        }
      }

      return updatedList;
    });

    await redisService.clearProductCache();
    return results;
  }
}

const inventoryService = new InventoryService(prisma);
export default inventoryService;
