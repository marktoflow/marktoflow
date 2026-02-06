/**
 * Zod input schemas for Stripe API actions.
 * Validates inputs BEFORE they reach the SDK to provide clear error messages.
 */

import { z } from 'zod';

export const stripeSchemas: Record<string, z.ZodTypeAny> = {
  createCustomer: z.object({
    email: z.string().email().optional(),
    name: z.string().optional(),
    description: z.string().optional(),
    metadata: z.record(z.unknown()).optional(),
  }).optional().default({}),

  getCustomer: z.object({
    customerId: z.string().min(1, 'customerId is required'),
  }),

  listCustomers: z.object({
    limit: z.number().int().min(1).max(100).optional(),
    email: z.string().email().optional(),
  }).optional().default({}),

  createPaymentIntent: z.object({
    amount: z.number().int().min(1, 'amount is required'),
    currency: z.string().length(3, 'currency must be 3-character code').min(1, 'currency is required'),
    customerId: z.string().optional(),
    paymentMethod: z.string().optional(),
    description: z.string().optional(),
  }),

  getPaymentIntent: z.object({
    paymentIntentId: z.string().min(1, 'paymentIntentId is required'),
  }),

  createSubscription: z.object({
    customerId: z.string().min(1, 'customerId is required'),
    priceId: z.string().min(1, 'priceId is required'),
  }),

  cancelSubscription: z.object({
    subscriptionId: z.string().min(1, 'subscriptionId is required'),
  }),

  createInvoice: z.object({
    customerId: z.string().min(1, 'customerId is required'),
  }),

  createProduct: z.object({
    name: z.string().min(1, 'name is required'),
    description: z.string().optional(),
  }),

  createPrice: z.object({
    productId: z.string().min(1, 'productId is required'),
    unitAmount: z.number().int().min(1, 'unitAmount is required'),
    currency: z.string().length(3, 'currency must be 3-character code').min(1, 'currency is required'),
    recurring: z.object({
      interval: z.enum(['day', 'week', 'month', 'year']).optional(),
      intervalCount: z.number().int().min(1).optional(),
    }).optional(),
  }),

  createRefund: z.object({
    paymentIntentId: z.string().min(1, 'paymentIntentId is required'),
    amount: z.number().int().min(1).optional(),
  }),
};
