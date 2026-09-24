import { Request, Response } from 'express';
import Stripe from 'stripe';
import orderService from '../database/Order-Service.js';
import { ApiResponse } from '../utils/api-response.js';
import config from '../config/nexus.config.js';
import { logger } from '../utils/logger.js';
import { User } from '../schemas/index.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || config.stripe.secretKey || 'sk_test_placeholder', {
  apiVersion: '2025-03-31.basil' as any,
});

const getPublishableKey = (req: Request, res: Response) => {
  return ApiResponse.success({
    res,
    data: {
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
      currency: config.stripe.currency,
    },
  });
};

const createCheckoutSession = async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    if (!user) {
      return ApiResponse.error({ res, statusCode: 401, message: 'Unauthorized' });
    }

    const { orderId } = req.body;
    let targetOrder;

    if (orderId) {
      targetOrder = await orderService.getOrder(orderId, user.id);
    } else {
      const orders = await orderService.getOrderUser(user.id);
      targetOrder = orders.find((o) => o.status === 'PENDING');
    }

    if (!targetOrder) {
      return ApiResponse.error({
        res,
        statusCode: 404,
        message: 'No pending order found for checkout. Please create an order first.',
      });
    }

    const lineItems = targetOrder.items && targetOrder.items.length > 0
      ? targetOrder.items.map((item) => ({
          price_data: {
            currency: config.stripe.currency,
            product_data: {
              name: item.productName,
              images: item.productImage ? [item.productImage] : undefined,
            },
            unit_amount: Math.round(Number(item.productPrice) * 100),
          },
          quantity: item.quantity,
        }))
      : [
          {
            price_data: {
              currency: config.stripe.currency,
              product_data: {
                name: `Order #${targetOrder.id.slice(0, 8)}`,
              },
              unit_amount: Math.round(Number(targetOrder.totalPrice) * 100),
            },
            quantity: 1,
          },
        ];

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: lineItems,
      customer_email: user.email,
      client_reference_id: user.id,
      success_url: `${config.clientUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}&order_id=${targetOrder.id}`,
      cancel_url: `${config.clientUrl}/checkout/cancel?order_id=${targetOrder.id}`,
      metadata: {
        orderId: targetOrder.id,
        userId: user.id,
      },
    });

    return ApiResponse.success({
      res,
      message: 'Stripe checkout session initialized',
      data: {
        sessionId: session.id,
        checkoutUrl: session.url,
        orderId: targetOrder.id,
      },
    });
  } catch (error) {
    logger.error('Stripe checkout session error:', error);
    return ApiResponse.error({
      res,
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Checkout session creation failed',
      error,
    });
  }
};

const handleWebhook = async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET || config.stripe.webhookSecret;
  let event: Stripe.Event;

  try {
    if (!sig || !endpointSecret) {
      throw new Error('Missing stripe webhook signature or endpoint secret');
    }
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    logger.error('Stripe webhook verification error:', err);
    res.status(400).send(`Webhook Error: ${(err as Error).message}`);
    return;
  }

  logger.info(`Received Stripe webhook event: ${event.type}`);

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const orderId = session.metadata?.orderId;

      if (orderId) {
        await orderService.payment(session.id, orderId, 'COMPLETED');
        logger.info(`Payment completed for order ${orderId} via session ${session.id}`);
      }

      res.status(200).json({ received: true });
      return;
    }

    if (event.type === 'checkout.session.expired' || event.type === 'payment_intent.payment_failed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const orderId = session.metadata?.orderId;

      if (orderId) {
        await orderService.payment(session.id, orderId, 'FAILED');
        logger.warn(`Payment failed or expired for order ${orderId}`);
      }

      res.status(200).json({ received: true, status: 'payment_failed' });
      return;
    }

    res.status(200).json({ received: true, ignored: true });
  } catch (processError) {
    logger.error('Error processing webhook event:', processError);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
};

export {
  getPublishableKey,
  getPublishableKey as GetPublishableKEY,
  handleWebhook as webhook,
  createCheckoutSession as payment,
};
