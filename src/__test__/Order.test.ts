import app from '../app.js';
import request from 'supertest';
import { Response } from 'supertest';
import * as bcrypt from 'bcrypt';
import * as cookie from 'cookie';
import redisClient from '../Utils/Get-Redis-Client.js';
import { PrismaClient, Product, Order, OrderStatus } from '@prisma/client';

const prisma = new PrismaClient();

const debugResponse = (res: Response): void => {
  console.log('\n--- DEBUG RESPONSE ---');
  console.log('Status:', res.status);
  console.log('Headers:', res.headers);
  console.log('Body:', JSON.stringify(res.body, null, 2));

  if (res.body?.err?.issues) {
    console.log('\nValidation Issues:');
    res.body.err.issues.forEach((issue: any, i: number) => {
      console.log(`Issue ${i + 1}:`, issue);
    });
  }
  console.log('--- END DEBUG ---\n');
};

describe('Order Routes Tests', () => {
  const testUser = {
    username: 'username',
    email: 'testEmail@gmail.com',
    password: 'password@1234H',
    firstName: 'user',
    lastName: 'test',
  };

  const testProduct = {
    name: 'Product1',
    description: 'mostWork',
    price: 1000,
    stock: 10,
    category: 'Test',
    tags: ['test', 'product'],
    imageUrl: 'https://example.com/image.png',
    isDeleted: false,
  };

  const testCartItem = {
    price: 1000,
    quantity: 1,
  };

  const shippingAddress = JSON.stringify({
    street: '123 Test St',
    city: 'Test City',
    state: 'Test State',
    zipCode: '12345',
    country: 'Test Country',
  });

  let cookies: string[];
  let userId: string;
  let csrfToken: string;
  let product: Product;
  let cartId: string;
  let orderId: string;

  beforeEach(async () => {
    await prisma.orderItem.deleteMany();
    await prisma.order.deleteMany();
    await prisma.cartItem.deleteMany();
    await prisma.cart.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.user.deleteMany();
    await prisma.product.deleteMany();
    await redisClient.flushDb();

    const user = await prisma.user.create({
      data: {
        ...testUser,
        password: await bcrypt.hash(testUser.password, 13),
        isVerified: true,
        role: 'ADMIN',
      },
    });

    userId = user.id;

    const loginRes = await request(app).post('/auth/login').send({
      email: testUser.email,
      password: testUser.password,
    });

    expect(loginRes.status).toBe(200);

    cookies = Array.isArray(loginRes.headers['set-cookie'])
      ? loginRes.headers['set-cookie']
      : [loginRes.headers['set-cookie']];

    expect(cookies.length).toBeGreaterThan(0);

    csrfToken =
      cookie.parse(cookies.find((c) => c.includes('XSRF-TOKEN')) || '')?.[
        'XSRF-TOKEN'
      ] || '';

    expect(csrfToken).toBeTruthy();

    product = await prisma.product.create({
      data: {
        ...testProduct,
      },
    });

    const result = await prisma.$transaction(async (tx) => {
      const cart = await tx.cart.create({
        data: { userId },
      });

      const product2 = await tx.product.create({
        data: {
          name: 'Product2',
          description: 'mostWork',
          price: 1000,
          stock: 10,
          category: 'Test',
          tags: ['test', 'product'],
          imageUrl: 'https://example.com/image.png',
          isDeleted: false,
        },
      });

      await tx.cartItem.create({
        data: {
          ...testCartItem,
          cartId: cart.id,
          productId: product.id,
        },
      });

      await tx.cartItem.create({
        data: {
          ...testCartItem,
          cartId: cart.id,
          productId: product2.id,
        },
      });

      return { cartId: cart.id, product2Id: product2.id };
    });

    cartId = result.cartId;
    return result;
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await redisClient.disconnect();
  });

  const createTestOrder = async (): Promise<Order> => {
    const res = await request(app)
      .post('/orders')
      .set('Cookie', cookies)
      .set('X-XSRF-TOKEN', csrfToken)
      .send({
        shippingAddress,
      });

    expect(res.status).toBe(201);
    expect(res.body.data).toBeDefined();

    return res.body.data;
  };

  it('should create a new order successfully', async () => {
    const res = await request(app)
      .post('/orders')
      .set('Cookie', cookies)
      .set('X-XSRF-TOKEN', csrfToken)
      .send({
        shippingAddress,
      });

    expect(res.status).toBe(201);
    expect(res.body.msg).toBe('Order created successfully');
    expect(res.body.data).toBeDefined();
    expect(res.body.data.status).toBe('PENDING');
    expect(res.body.data.items.length).toBe(2);
    expect(Number(res.body.data.totalPrice)).toBe(2000);

    const cart = await prisma.cartItem.findMany({
      where: { cartId },
    });
    expect(cart.length).toBe(0);

    const updatedProduct = await prisma.product.findUnique({
      where: { id: product.id },
    });

    expect(updatedProduct!.stock).toBe(9);
    orderId = res.body.data.id;
  });

  it('should get all orders for the current user', async () => {
    await createTestOrder();

    const res = await request(app)
      .get('/orders/user')
      .set('Cookie', cookies)
      .set('X-XSRF-TOKEN', csrfToken);

    expect(res.status).toBe(201);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0].userId).toBe(userId);
    expect(res.body.data[0].items.length).toBe(2);
  });

  it('should get a specific order by ID', async () => {
    const order = await createTestOrder();

    const res = await request(app)
      .get(`/orders/${order.id}`)
      .set('Cookie', cookies)
      .set('X-XSRF-TOKEN', csrfToken);

    expect(res.status).toBe(201);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.id).toBe(order.id);
    expect(res.body.data.items.length).toBe(2);
  });

  it('should delete a pending order', async () => {
    const order = await createTestOrder();

    const res = await request(app)
      .delete(`/orders/${order.id}`)
      .set('Cookie', cookies)
      .set('X-XSRF-TOKEN', csrfToken);

    debugResponse(res);
    expect(res.status).toBe(200);
    expect(res.body.msg).toBe('Order deleted successfully');

    const deletedOrder = await prisma.order.findUnique({
      where: { id: order.id },
    });
    expect(deletedOrder).toBeNull();

    const updatedProduct = await prisma.product.findUnique({
      where: { id: product.id },
    });
    expect(updatedProduct!.stock).toBe(10);
  });

  describe('GET /orders', () => {
    it('should get all orders (admin endpoint)', async () => {
      // Create an order first
      await createTestOrder();

      const res = await request(app)
        .get('/orders')
        .set('Cookie', cookies)
        .set('X-XSRF-TOKEN', csrfToken);

      expect(res.status).toBe(201);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });
  });

  describe('PATCH /orders/:orderId/status', () => {
    it('should update order status from PENDING to PAID', async () => {
      const order = await createTestOrder();

      const res = await request(app)
        .patch(`/orders/${order.id}/status`)
        .set('Cookie', cookies)
        .set('X-XSRF-TOKEN', csrfToken)
        .send({
          status: 'PAID',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe('PAID');
    });

    it('should update order status from PAID to SHIPPED', async () => {
      const order = await createTestOrder();

      // First update to PAID
      await prisma.order.update({
        where: { id: order.id },
        data: { status: 'PAID' },
      });

      const res = await request(app)
        .patch(`/orders/${order.id}/status`)
        .set('Cookie', cookies)
        .set('X-XSRF-TOKEN', csrfToken)
        .send({
          status: 'SHIPPED',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe('SHIPPED');
    });
  });
});
