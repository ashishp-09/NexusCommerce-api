import express from 'express';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import xssClean from 'xss-clean';
import helmet from 'helmet';
import cors from 'cors';

dotenv.config();

import { requestIdMiddleware } from './middleware/request-id.js';
import rateLimiting from './middleware/limiter.js';
import { authRouter } from './routes/Auth.js';
import { productRouter } from './routes/Product.js';
import { reviewRouter } from './routes/Reviews.js';
import { cartRouter } from './routes/Cart.js';
import { orderRouter } from './routes/Order.js';
import { paymentRouter } from './routes/payment.js';
import { couponRouter } from './routes/Coupon.js';
import { wishlistRouter } from './routes/Wishlist.js';
import { addressRouter } from './routes/Address.js';
import { inventoryRouter } from './routes/Inventory.js';
import { healthRouter } from './routes/Health.js';
import { authMiddleware } from './middleware/Auth-Middleware.js';
import { validateCSRF } from './middleware/CSRF.validation.js';
import errorHandler from './middleware/Error-handler.js';
import config from './config/nexus.config.js';

const app = express();

const corsOptions = {
  origin: [config.clientUrl, 'http://localhost:3000', 'http://localhost:5173'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Request-ID'],
  exposedHeaders: ['set-cookie', 'XSRF-TOKEN', 'X-Request-ID'],
  credentials: true,
};

// Security & Parsing Middleware
app.use(requestIdMiddleware);
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", 'trusted-cdn.com'],
        imgSrc: ["'self'", 'https:', 'data:'],
      },
    },
    frameguard: { action: 'deny' },
  })
);

app.use(xssClean());
app.use(cors(corsOptions));
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());
app.use(rateLimiting);

// Health check endpoints
app.use('/healthz', healthRouter);
app.use('/api/v1/health', healthRouter);

// API Routes
app.use('/auth', authRouter);
app.use('/product', productRouter);
app.use('/review', reviewRouter);
app.use('/cart', authMiddleware, validateCSRF, cartRouter);
app.use('/orders', authMiddleware, validateCSRF, orderRouter);
app.use('/payment', paymentRouter);
app.use('/coupons', couponRouter);
app.use('/wishlist', wishlistRouter);
app.use('/address', addressRouter);
app.use('/inventory', inventoryRouter);

// Versioned API v1 Aliases
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/product', productRouter);
app.use('/api/v1/review', reviewRouter);
app.use('/api/v1/cart', authMiddleware, validateCSRF, cartRouter);
app.use('/api/v1/orders', authMiddleware, validateCSRF, orderRouter);
app.use('/api/v1/payment', paymentRouter);
app.use('/api/v1/coupons', couponRouter);
app.use('/api/v1/wishlist', wishlistRouter);
app.use('/api/v1/address', addressRouter);
app.use('/api/v1/inventory', inventoryRouter);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    statusCode: 404,
    message: `Resource at route ${req.originalUrl} not found`,
    timestamp: new Date().toISOString(),
  });
});

// Global Error Handler
app.use(errorHandler);

export default app;
