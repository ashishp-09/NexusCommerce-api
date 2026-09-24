import app from '../app.js';
import request from 'supertest';
import { Response } from 'supertest';
import * as bcrypt from 'bcrypt';
import * as cookie from 'cookie';
import redisClient from '../Utils/Get-Redis-Client.js';
import { PrismaClient } from '@prisma/client';
import path from 'path';
import * as fs from 'fs';

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

describe('Product Routes Tests', () => {
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

  let cookies: string[];
  let userId: string;
  let csrfToken: string;
  let mockFilePath: string;

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

    mockFilePath = path.join(__dirname, 'mock-image.png');
    fs.writeFileSync(mockFilePath, 'dummy-image-data');
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await redisClient.disconnect();

    if (fs.existsSync(mockFilePath)) {
      fs.unlinkSync(mockFilePath);
    }
    const uploadDir = path.join(__dirname, '../../uploads');
    fs.readdirSync(uploadDir).forEach((file) => {
      fs.unlinkSync(path.join(uploadDir, file));
    });
  });

  const createTestProduct = async (overrides = {}) => {
    return await prisma.product.create({
      data: {
        ...testProduct,
        ...overrides,
      },
    });
  };

  it('should add a new product with valid data and image', async () => {
    const validProductData = {
      name: 'Valid Product Name',
      description: 'Proper description',
      price: '1000',
      stock: '10',
      category: 'Test',
      tags: JSON.stringify(['test', 'product']),
    };

    const res = await request(app)
      .post('/product')
      .set('Cookie', cookies)
      .set('x-csrf-token', csrfToken)
      .field('name', validProductData.name)
      .field('description', validProductData.description)
      .field('price', validProductData.price)
      .field('stock', validProductData.stock)
      .field('category', validProductData.category)
      .field('tags', validProductData.tags)
      .attach('image', mockFilePath);

    debugResponse(res);

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('msg', validProductData.name);

    const createdProduct = await prisma.product.findFirst({
      where: { name: validProductData.name },
    });

    expect(createdProduct).not.toBeNull();
    expect(createdProduct?.name).toBe(validProductData.name);
    expect(Number(createdProduct?.price)).toBe(Number(validProductData.price));
    expect(createdProduct?.imageUrl).toMatch(/uploads[\/\\]/);
  });

  it('should soft-delete a product', async () => {
    const product = await createTestProduct();

    expect(product).not.toBeNull();

    const res = await request(app)
      .delete(`/product/${product.id}`)
      .set('Cookie', cookies)
      .set('x-csrf-token', csrfToken);

    if (res.status !== 200) {
      console.log('Delete response:', res.status, res.body);
    }

    expect(res.status).toBe(200);

    await new Promise((resolve) => setTimeout(resolve, 100));

    const softDeletedProduct = await prisma.product.findFirst({
      where: { id: product.id },
    });

    expect(softDeletedProduct).toBeNull();
  });

  it('should update a product', async () => {
    const product = await createTestProduct();

    expect(product).not.toBeNull();
    expect(product.id).toBeTruthy();

    const newName = 'Updated Product Name';

    const res = await request(app)
      .patch(`/product/${product.id}`)
      .send({ name: newName })
      .set('Cookie', cookies)
      .set('x-csrf-token', csrfToken);

    if (res.status !== 200) {
      console.log('Update response:', res.status, res.body);
    }

    expect(res.status).toBe(200);

    const updatedProduct = await prisma.product.findFirst({
      where: { id: product.id },
    });

    expect(updatedProduct?.name).toBe(newName);
  });

  describe('Product visibility management', () => {
    it('should hide a product by setting isDeleted to true', async () => {
      const product = await createTestProduct();

      const res = await request(app)
        .patch(`/product/hide/${product.id}`)
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken);

      if (res.status !== 200) {
        console.log('Hide response:', res.status, res.body);
      }

      expect(res.status).toBe(200);

      const hiddenProduct = await prisma.product.findFirst({
        where: { id: product.id },
      });

      expect(hiddenProduct?.isDeleted).toBe(true);
    });

    it('should restore a soft-deleted product', async () => {
      const product = await createTestProduct({ isDeleted: true });

      const res = await request(app)
        .patch(`/product/restore/${product.id}`)
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken);

      if (res.status !== 200) {
        console.log('Restore response:', res.status, res.body);
      }

      expect(res.status).toBe(200);

      const restoredProduct = await prisma.product.findFirst({
        where: { id: product.id },
      });

      expect(restoredProduct?.isDeleted).toBe(false);
    });
  });

  it('should get all categories', async () => {
    await createTestProduct({ category: 'Electronics' });
    await createTestProduct({ category: 'Clothing' });

    const res = await request(app)
      .get('/product/categories')
      .set('Cookie', cookies)
      .set('x-csrf-token', csrfToken);

    expect(res.status).toBe(200);

    // Fix: Check if data is nested or handle both formats
    const categories = Array.isArray(res.body.data)
      ? res.body.data
      : res.body.data?.categories || [];

    expect(Array.isArray(categories)).toBe(true);
    expect(categories.length).toBeGreaterThanOrEqual(2);

    // Adjust how we extract category names based on response structure
    const categoryNames = categories.map((item: any) =>
      typeof item === 'string' ? item : item.category || item.name
    );

    expect(categoryNames).toContain('Electronics');
    expect(categoryNames).toContain('Clothing');
  });

  it('should get all tags', async () => {
    await createTestProduct({ tags: ['popular', 'electronic'] });
    await createTestProduct({ tags: ['sale', 'clothing'] });

    const res = await request(app)
      .get('/product/tags')
      .set('Cookie', cookies)
      .set('x-csrf-token', csrfToken);

    expect(res.status).toBe(200);

    const tags = Array.isArray(res.body.data)
      ? res.body.data
      : res.body.data?.tags || [];

    expect(Array.isArray(tags)).toBe(true);
    expect(tags.length).toBeGreaterThanOrEqual(4);

    const tagStrings = tags.map((tag: any) =>
      typeof tag === 'string' ? tag : tag.name
    );

    expect(tagStrings).toContain('popular');
    expect(tagStrings).toContain('electronic');
    expect(tagStrings).toContain('sale');
    expect(tagStrings).toContain('clothing');
  });

  it('should retrieve hidden products', async () => {
    const a = await createTestProduct({
      isDeleted: true,
      name: 'Hidden Product 1',
    });
    await createTestProduct({ isDeleted: true, name: 'Hidden Product 2' });

    const res = await request(app)
      .get('/product/hidden')
      .set('Cookie', cookies)
      .set('x-csrf-token', csrfToken);

    expect(res.status).toBe(200);

    const products = Array.isArray(res.body.data)
      ? res.body.data
      : res.body.data?.products || [];

    expect(Array.isArray(products)).toBe(true);
    expect(products.length).toBeGreaterThanOrEqual(2);

    const productNames = products.map((item: any) => item.name);
    expect(productNames).toContain('Hidden Product 1');
    expect(productNames).toContain('Hidden Product 2');
  });
});
