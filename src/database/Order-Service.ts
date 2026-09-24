import { PrismaClient, OrderStatus, PaymentStatus } from '@prisma/client';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../errors/Custom-errors.js';

const prisma = new PrismaClient();

class OrderService {
  constructor(private readonly prisma: PrismaClient) {}

  async createOrder(userId: string, shippingAddress: string | object) {
    const cart = await this.prisma.cart.findUnique({
      where: { userId },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!cart || cart.items.length === 0) {
      throw new NotFoundError('Cart is empty. Add products before checking out.');
    }

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const stockIssues: string[] = [];

        // Validate stock availability for all items
        for (const item of cart.items) {
          const currentProduct = await tx.product.findUnique({
            where: { id: item.productId },
          });

          if (!currentProduct) {
            stockIssues.push(`Product "${item.product.name}" is no longer available`);
          } else if (currentProduct.isDeleted) {
            stockIssues.push(`Product "${item.product.name}" has been removed from store`);
          } else if (item.quantity > currentProduct.stock) {
            stockIssues.push(
              `Insufficient stock for "${item.product.name}". Available: ${currentProduct.stock}, Requested: ${item.quantity}`
            );
          }
        }

        if (stockIssues.length > 0) {
          throw new ConflictError(stockIssues.join('; '));
        }

        const totalPrice = cart.items.reduce((sum, item) => {
          return sum + item.quantity * Number(item.product.price);
        }, 0);

        // Deduct stock for each purchased item
        await Promise.all(
          cart.items.map((item) =>
            tx.product.update({
              where: { id: item.productId },
              data: { stock: { decrement: item.quantity } },
            })
          )
        );

        let parsedShippingAddress;
        try {
          parsedShippingAddress =
            typeof shippingAddress === 'string'
              ? JSON.parse(shippingAddress)
              : shippingAddress;
        } catch {
          parsedShippingAddress = { address: String(shippingAddress) };
        }

        const order = await tx.order.create({
          data: {
            userId,
            totalPrice,
            status: 'PENDING',
            paymentMethod: 'STRIPE',
            shippingAddress: parsedShippingAddress,
            items: {
              create: cart.items.map((item) => ({
                productId: item.productId,
                productName: item.product.name,
                productPrice: item.product.price,
                productImage: item.product.imageUrl,
                quantity: item.quantity,
                price: item.quantity * Number(item.product.price),
              })),
            },
          },
          include: { items: true },
        });

        // Clear cart after creating the order
        await tx.cartItem.deleteMany({ where: { cartId: cart.id } });

        return order;
      });

      return result;
    } catch (error) {
      if (error instanceof ConflictError || error instanceof ValidationError) {
        throw error;
      }
      if (error instanceof Error) {
        throw new Error(`Order creation failed: ${error.message}`);
      }
      throw new Error('Order creation failed due to an unknown error');
    }
  }

  async deleteOrder(userId: string, orderId: string) {
    return await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: {
          id: orderId,
          userId,
        },
        include: {
          items: true,
        },
      });

      if (!order) {
        throw new NotFoundError('Order not found or does not belong to this user');
      }

      if (order.status !== 'PENDING') {
        throw new ForbiddenError('Only pending orders can be cancelled');
      }

      await tx.orderItem.deleteMany({
        where: { orderId: order.id },
      });

      // Restore inventory stock
      await Promise.all(
        order.items.map((item) =>
          tx.product.update({
            where: { id: item.productId },
            data: { stock: { increment: item.quantity } },
          })
        )
      );

      return await tx.order.delete({
        where: { id: order.id },
      });
    });
  }

  async getAllOrders(page: number = 1, limit: number = 20) {
    const [orders, totalCount] = await Promise.all([
      this.prisma.order.findMany({
        include: {
          items: true,
          payment: true,
          user: {
            select: { id: true, username: true, email: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.order.count(),
    ]);

    return {
      orders,
      pagination: {
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit),
      },
    };
  }

  async getOrderUser(userId: string) {
    return await this.prisma.order.findMany({
      where: { userId },
      include: {
        items: true,
        payment: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async getOrder(orderId: string, userId?: string) {
    const where: { id: string; userId?: string } = { id: orderId };
    if (userId) {
      where.userId = userId;
    }

    const order = await this.prisma.order.findFirst({
      where,
      include: {
        items: true,
        payment: true,
        user: {
          select: { id: true, username: true, email: true },
        },
      },
    });

    if (!order) {
      throw new NotFoundError(`Order with ID ${orderId} not found`);
    }

    return order;
  }

  async updateOrderStatus(orderId: string, status: OrderStatus) {
    return await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order) {
        throw new NotFoundError('Order not found');
      }

      const validTransitions: Record<OrderStatus, OrderStatus[]> = {
        PENDING: ['PAID', 'SHIPPED'],
        PAID: ['SHIPPED'],
        SHIPPED: [],
      };

      if (!validTransitions[order.status].includes(status)) {
        throw new ValidationError(
          `Invalid status transition from ${order.status} to ${status}`
        );
      }

      return await tx.order.update({
        where: { id: orderId },
        data: { status },
        include: { items: true, payment: true },
      });
    });
  }

  async getOrderSummary(userId: string) {
    const orders = await this.prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    if (!orders || orders.length === 0) {
      return { totalOrders: 0, totalSpent: 0, recentOrderId: null };
    }

    const totalSpent = orders.reduce((sum, o) => sum + Number(o.totalPrice), 0);
    return {
      recentOrderId: orders[0].id,
      totalOrders: orders.length,
      totalSpent: parseFloat(totalSpent.toFixed(2)),
    };
  }

  async payment(sessionId: string, orderId: string, status: PaymentStatus) {
    return await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order) {
        throw new NotFoundError('Order not found');
      }

      const payment = await tx.payment.upsert({
        where: { orderId },
        update: {
          transactionId: sessionId,
          status,
        },
        create: {
          paymentMethod: 'STRIPE',
          transactionId: sessionId,
          status,
          orderId,
        },
      });

      if (status === 'COMPLETED') {
        await tx.order.update({
          where: { id: orderId },
          data: { status: 'PAID' },
        });
      }

      return payment;
    });
  }

  async getAnalyticsSummary() {
    const [ordersCount, paidOrders, totalProducts, usersCount] = await Promise.all([
      this.prisma.order.count(),
      this.prisma.order.findMany({
        where: { status: { in: ['PAID', 'SHIPPED'] } },
        select: { totalPrice: true },
      }),
      this.prisma.product.count({ where: { isDeleted: false } }),
      this.prisma.user.count(),
    ]);

    const totalRevenue = paidOrders.reduce((sum, o) => sum + Number(o.totalPrice), 0);
    const averageOrderValue = paidOrders.length > 0 ? totalRevenue / paidOrders.length : 0;

    return {
      totalOrders: ordersCount,
      completedOrders: paidOrders.length,
      totalRevenue: parseFloat(totalRevenue.toFixed(2)),
      averageOrderValue: parseFloat(averageOrderValue.toFixed(2)),
      totalProducts,
      totalUsers: usersCount,
    };
  }
}

const orderService = new OrderService(prisma);
export default orderService;
