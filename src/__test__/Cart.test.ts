import app from '../app.js';
import request from 'supertest';
import { Response } from 'supertest';
import * as bcrypt from 'bcrypt';
import * as cookie from 'cookie';
import redisClient from '../Utils/Get-Redis-Client.js';
import { PrismaClient, Product } from '@prisma/client';

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

describe('Cart Routes Tests', () => {
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

  let cookies: string[];
  let userId: string;
  let csrfToken: string;
  let product: Product;
  let cartId: string;

  beforeEach(async () => {
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
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await redisClient.disconnect();
  });

  const createTestCart = async () => {
    const result = await prisma.$transaction(async (prisma) => {
      const cart = await prisma.cart.create({
        data: { userId },
      });

      const product2 = await prisma.product.create({
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

      await prisma.cartItem.create({
        data: {
          ...testCartItem,
          cartId: cart.id,
          productId: product.id,
        },
      });

      await prisma.cartItem.create({
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
  };

  it('should add a new item to cart', async () => {
    const res = await request(app)
      .post('/cart')
      .send({ ...testCartItem, productId: product.id })
      .set('Cookie', cookies)
      .set('x-csrf-token', csrfToken);

    expect(res.status).toBe(200);

    const newUser = await prisma.user.findFirst({
      where: { id: userId },
      include: { cart: true },
    });
    expect(newUser?.cart).toBeDefined();

    const cart = await prisma.cart.findFirst({
      where: { userId: userId },
      include: { items: true },
    });
    expect(cart?.items.length).toBe(1);
  });

  it('should clear Cart', async () => {
    await createTestCart();

    const res = await request(app)
      .delete('/cart')
      .set('Cookie', cookies)
      .set('x-csrf-token', csrfToken);

    expect(res.status).toBe(200);

    const cart = await prisma.cart.findFirst({
      where: { userId: userId },
      include: { items: true },
    });

    expect(cart).toBeDefined();
    expect(cart?.items.length).toBe(0);
  });

  it('should delete one item from cart', async () => {
    await createTestCart();

    const res = await request(app)
      .delete(`/cart/${product.id}`)
      .set('Cookie', cookies)
      .set('x-csrf-token', csrfToken);

    expect(res.status).toBe(200);

    const cart = await prisma.cart.findFirst({
      where: { userId: userId },
      include: { items: true },
    });

    expect(cart).toBeDefined();
    expect(cart?.items.length).toBe(1);
  });

  it('should update one item from cart', async () => {
    const { product2Id } = await createTestCart();
    const newQuantity = 2;

    const res = await request(app)
      .patch('/cart')
      .send({
        productId: product.id,
        quantity: newQuantity,
      })
      .set('Cookie', cookies)
      .set('x-csrf-token', csrfToken);

    expect(res.status).toBe(200);

    const cart = await prisma.cart.findFirst({
      where: { userId: userId },
      include: {
        items: {
          where: { productId: product.id },
        },
      },
    });

    expect(cart).toBeDefined();
    expect(cart?.items[0].quantity).toBe(newQuantity);
  });

  it('should get items from cart', async () => {
    await createTestCart();

    const res = await request(app)
      .get('/cart')
      .set('Cookie', cookies)
      .set('x-csrf-token', csrfToken);

    expect(res.status).toBe(200);

    const cart = await prisma.cart.findFirst({
      where: { userId: userId },
      include: { items: true },
    });

    expect(cart).toBeDefined();
    expect(res.body.data.length).toBe(cart?.items.length);
  });

  it('should reject cart update without CSRF token', async () => {
    const res = await request(app).patch('/cart').set('Cookie', cookies);
    expect(res.status).toBe(403);
  });
});
