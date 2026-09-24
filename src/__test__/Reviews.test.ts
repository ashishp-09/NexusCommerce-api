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

describe('Review Routes Tests', () => {
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

  const testReviews = {
    rating: 2.5,
    comment: 'I like it ',
  };

  let cookies: string[];
  let userId: string;
  let csrfToken: string;
  let product: Product;

  beforeEach(async () => {
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

  const createTestRevew = async () => {
    return await prisma.review.create({
      data: {
        productId: product.id,
        userId: userId,
        ...testReviews,
      },
    });
  };

  it('should add a new review', async () => {
    const res = await request(app)
      .post('/review')
      .send({
        ...testReviews,
        productId: product.id,
      })
      .set('Cookie', cookies)
      .set('x-csrf-token', csrfToken);

    expect(res.status).toBe(201);
    expect(res.body.data.userId).toBe(userId);
    expect(res.body.data.productId).toBe(product.id);

    const updatedProduct = await prisma.product.findUnique({
      where: { id: product.id },
    });

    expect(Number(updatedProduct?.rating)).toBe(testReviews.rating);
  });

  it('should update a review', async () => {
    const review = await createTestRevew();
    const newRating = 4.1;

    const res = await request(app)
      .patch(`/review/${product?.id}`)
      .send({ rating: newRating })
      .set('Cookie', cookies)
      .set('x-csrf-token', csrfToken);

    debugResponse(res);
    expect(res.status).toBe(200);
    expect(res.body.data.rating).toBe(newRating);

    const updatedProduct = await prisma.product.findUnique({
      where: { id: product.id },
    });
    expect(Number(updatedProduct?.rating)).toBe(newRating);
  });

  it('should delete a review', async () => {
    const review = await createTestRevew();

    const res = await request(app)
      .delete(`/review/${product?.id}`)
      .set('Cookie', cookies)
      .set('x-csrf-token', csrfToken);

    expect(res.status).toBe(200);

    const deletedReview = await prisma.review.findUnique({
      where: { id: review.id },
    });
    expect(deletedReview).toBeNull();

    const updatedProduct = await prisma.product.findUnique({
      where: { id: product.id },
    });
    expect(Number(updatedProduct?.rating)).toBe(0);
  });

  it('should get reviews for a product', async () => {
    await createTestRevew();

    const res = await request(app)
      .get(`/review/${product?.id}`)
      .set('Cookie', cookies)
      .set('x-csrf-token', csrfToken);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBeTruthy();
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].rating).toBe(testReviews.rating);
  });
});
