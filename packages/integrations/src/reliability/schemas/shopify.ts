/**
 * Zod input schemas for Shopify API actions.
 * Validates inputs BEFORE they reach the SDK to provide clear error messages.
 */

import { z } from 'zod';

export const shopifySchemas: Record<string, z.ZodTypeAny> = {
  getProducts: z.object({
    limit: z.number().int().min(1).max(250).optional(),
    page: z.number().int().min(1).optional(),
  }).optional().default({}),

  getProduct: z.object({
    productId: z.string().min(1, 'productId is required'),
  }),

  createProduct: z.object({
    title: z.string().min(1, 'title is required'),
    bodyHtml: z.string().optional(),
    vendor: z.string().optional(),
    productType: z.string().optional(),
    tags: z.string().optional(),
  }),

  updateProduct: z.object({
    productId: z.string().min(1, 'productId is required'),
    title: z.string().optional(),
    bodyHtml: z.string().optional(),
  }),

  deleteProduct: z.object({
    productId: z.string().min(1, 'productId is required'),
  }),

  getOrders: z.object({
    limit: z.number().int().min(1).max(250).optional(),
    status: z.enum(['any', 'cancelled', 'completed', 'expired', 'failed', 'pending', 'paid', 'refunded', 'voided']).optional(),
  }).optional().default({}),

  getOrder: z.object({
    orderId: z.string().min(1, 'orderId is required'),
  }),

  createOrder: z.object({
    lineItems: z.array(z.object({
      variantId: z.string().min(1, 'variantId is required'),
      quantity: z.number().int().min(1, 'quantity is required'),
    })).min(1, 'lineItems is required'),
    email: z.string().email().optional(),
  }),

  getCustomers: z.object({
    limit: z.number().int().min(1).max(250).optional(),
  }).optional().default({}),

  getCustomer: z.object({
    customerId: z.string().min(1, 'customerId is required'),
  }),

  createCustomer: z.object({
    email: z.string().email().min(1, 'email is required'),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
  }),
};
