import { PrismaClient } from '@prisma/client';
import { Cart, cartSchema } from '../schemas/index.js';
import { NotFoundError, ConflictError } from '../errors/Custom-errors.js';

const prisma = new PrismaClient();

class CartService {
  constructor(private readonly prisma: PrismaClient) {}

  async checkQuantity(quantity: number, productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId, isDeleted: false },
    });

    if (!product) {
      throw new NotFoundError('Product not found or has been removed');
    }

    if (product.stock < quantity) {
      throw new ConflictError(
        `Insufficient stock for "${product.name}". Available: ${product.stock}, Requested: ${quantity}`
      );
    }

    return product;
  }

  async addOrCreateCartItem(userId: string, itemData: Cart) {
    const validItemData = cartSchema.parse(itemData);
    const product = await this.checkQuantity(validItemData.quantity, validItemData.productId);

    return await this.prisma.$transaction(async (tx) => {
      let cart = await tx.cart.findUnique({
        where: { userId },
      });

      if (!cart) {
        cart = await tx.cart.create({
          data: { userId },
        });
      }

      const existingCartItem = await tx.cartItem.findUnique({
        where: {
          cartId_productId: {
            cartId: cart.id,
            productId: validItemData.productId,
          },
        },
      });

      let item;
      if (existingCartItem) {
        const newQuantity = existingCartItem.quantity + validItemData.quantity;
        if (product.stock < newQuantity) {
          throw new ConflictError(
            `Cannot add ${validItemData.quantity} more. Current cart: ${existingCartItem.quantity}, Stock: ${product.stock}`
          );
        }
        item = await tx.cartItem.update({
          where: { id: existingCartItem.id },
          data: {
            quantity: newQuantity,
            price: validItemData.price,
          },
        });
      } else {
        item = await tx.cartItem.create({
          data: {
            ...validItemData,
            cartId: cart.id,
          },
        });
      }

      return {
        cart,
        item,
      };
    });
  }

  async deleteItemFromCart(productId: string, userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { cart: true },
    });

    if (!user || !user.cart) {
      throw new NotFoundError('Cart not found for user');
    }

    const cartItem = await this.prisma.cartItem.findUnique({
      where: {
        cartId_productId: {
          cartId: user.cart.id,
          productId,
        },
      },
    });

    if (!cartItem) {
      throw new NotFoundError('Item does not exist in cart');
    }

    return await this.prisma.cartItem.delete({
      where: {
        cartId_productId: {
          cartId: user.cart.id,
          productId,
        },
      },
    });
  }

  async clearCart(userId: string) {
    return await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        include: { cart: true },
      });
      if (!user?.cart) throw new NotFoundError('User or cart not found');

      const { count } = await tx.cartItem.deleteMany({
        where: { cartId: user.cart.id },
      });

      return { message: `Cleared ${count} items from cart` };
    });
  }

  async getCart(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        cart: {
          include: {
            items: {
              include: {
                product: {
                  select: {
                    id: true,
                    name: true,
                    price: true,
                    stock: true,
                    imageUrl: true,
                    category: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    if (!user.cart) {
      return {
        id: null,
        userId,
        items: [],
        subtotal: 0,
        itemCount: 0,
      };
    }

    const subtotal = user.cart.items.reduce(
      (sum, item) => sum + Number(item.price) * item.quantity,
      0
    );

    const itemCount = user.cart.items.reduce(
      (count, item) => count + item.quantity,
      0
    );

    return {
      id: user.cart.id,
      userId,
      items: user.cart.items,
      subtotal: parseFloat(subtotal.toFixed(2)),
      itemCount,
    };
  }

  async getItems(userId: string) {
    const cart = await this.getCart(userId);
    return cart.items;
  }

  async updateCartItemQuantity(
    productId: string,
    userId: string,
    newQuantity: number
  ) {
    if (newQuantity <= 0) {
      return this.deleteItemFromCart(productId, userId);
    }

    return await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        include: { cart: true },
      });
      if (!user?.cart) throw new NotFoundError('User or cart not found');

      const cartItem = await tx.cartItem.findUnique({
        where: { cartId_productId: { cartId: user.cart.id, productId } },
      });
      if (!cartItem) throw new NotFoundError('Item not in cart');

      await this.checkQuantity(newQuantity, productId);

      return tx.cartItem.update({
        where: { cartId_productId: { cartId: user.cart.id, productId } },
        data: { quantity: newQuantity },
      });
    });
  }
}

const cartService = new CartService(prisma);
export default cartService;
