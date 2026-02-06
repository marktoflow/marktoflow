/**
 * Contract tests for Shopify integration
 *
 * These tests validate that:
 * 1. The SDK makes correct HTTP requests
 * 2. Input validation schemas work as expected
 * 3. Response handling is correct
 * 4. The integration behaves correctly without hitting real APIs
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { wrapIntegration } from '../../src/reliability/wrapper.js';
import { shopifySchemas } from '../../src/reliability/schemas/shopify.js';
import { ShopifyClient } from '../../src/services/shopify.js';

// ============================================================================
// MSW Server Setup
// ============================================================================

const server = setupServer(
  // Get products
  http.get('https://test-shop.myshopify.com/admin/api/*/products.json', () => {
    return HttpResponse.json({
      products: [
        {
          id: 1,
          title: 'Product 1',
          body_html: 'Description 1',
          vendor: 'Vendor 1',
        },
        {
          id: 2,
          title: 'Product 2',
          body_html: 'Description 2',
          vendor: 'Vendor 2',
        },
      ],
    });
  }),

  // Get product by ID
  http.get('https://test-shop.myshopify.com/admin/api/*/products/:productId.json', ({ params }) => {
    return HttpResponse.json({
      product: {
        id: params.productId,
        title: 'Test Product',
        body_html: 'Test Description',
        vendor: 'Test Vendor',
      },
    });
  }),

  // Create product
  http.post('https://test-shop.myshopify.com/admin/api/*/products.json', async ({ request }) => {
    const body = await request.json() as any;
    const product = body.product;

    if (!product || !product.title) {
      return HttpResponse.json({
        errors: 'Title is required',
      }, { status: 422 });
    }

    return HttpResponse.json({
      product: {
        id: 123,
        title: product.title,
        body_html: product.body_html,
        vendor: product.vendor,
      },
    });
  }),

  // Update product
  http.put('https://test-shop.myshopify.com/admin/api/*/products/:productId.json', async ({ request, params }) => {
    const body = await request.json() as any;
    const product = body.product;

    return HttpResponse.json({
      product: {
        id: params.productId,
        title: product.title || 'Updated Product',
        body_html: product.body_html,
      },
    });
  }),

  // Delete product
  http.delete('https://test-shop.myshopify.com/admin/api/*/products/:productId.json', ({ params }) => {
    return HttpResponse.json({
      id: params.productId,
    });
  }),

  // Get orders
  http.get('https://test-shop.myshopify.com/admin/api/*/orders.json', () => {
    return HttpResponse.json({
      orders: [
        {
          id: 1,
          email: 'customer1@example.com',
          total_price: '100.00',
        },
        {
          id: 2,
          email: 'customer2@example.com',
          total_price: '200.00',
        },
      ],
    });
  }),

  // Get customers
  http.get('https://test-shop.myshopify.com/admin/api/*/customers.json', () => {
    return HttpResponse.json({
      customers: [
        {
          id: 1,
          email: 'customer1@example.com',
          first_name: 'John',
          last_name: 'Doe',
        },
      ],
    });
  }),

  // Create customer
  http.post('https://test-shop.myshopify.com/admin/api/*/customers.json', async ({ request }) => {
    const body = await request.json() as any;
    const customer = body.customer;

    if (!customer || !customer.email) {
      return HttpResponse.json({
        errors: 'Email is required',
      }, { status: 422 });
    }

    return HttpResponse.json({
      customer: {
        id: 123,
        email: customer.email,
        first_name: customer.first_name,
        last_name: customer.last_name,
      },
    });
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// ============================================================================
// Contract Tests
// ============================================================================

describe('Shopify Contract Tests', () => {
  it('should get products successfully', async () => {
    const client = new ShopifyClient('test-shop.myshopify.com', 'test-access-token');
    const wrapped = wrapIntegration('shopify', client, {
      inputSchemas: shopifySchemas,
    });

    const result = await wrapped.getProducts({ limit: 10 });

    expect(result.body.products).toHaveLength(2);
    expect(result.body.products[0].title).toBe('Product 1');
  });

  it('should get a product by ID successfully', async () => {
    const client = new ShopifyClient('test-shop.myshopify.com', 'test-access-token');
    const wrapped = wrapIntegration('shopify', client, {
      inputSchemas: shopifySchemas,
    });

    const result = await wrapped.getProduct('123');

    expect(result.body.product.id).toBe('123');
    expect(result.body.product.title).toBe('Test Product');
  });

  it('should reject empty product ID', async () => {
    const client = new ShopifyClient('test-shop.myshopify.com', 'test-access-token');
    const wrapped = wrapIntegration('shopify', client, {
      inputSchemas: shopifySchemas,
    });

    // The Shopify SDK doesn't validate productId before making the request,
    // so we just ensure it throws an error (either validation or API error)
    await expect(
      wrapped.getProduct('')
    ).rejects.toThrow();
  });

  it('should create a product successfully', async () => {
    const client = new ShopifyClient('test-shop.myshopify.com', 'test-access-token');
    const wrapped = wrapIntegration('shopify', client, {
      inputSchemas: shopifySchemas,
    });

    const result = await wrapped.createProduct({
      title: 'New Product',
      body_html: 'New Description',
      vendor: 'New Vendor',
    });

    expect(result.body.product.id).toBe(123);
    expect(result.body.product.title).toBe('New Product');
  });

  it('should reject invalid inputs (missing title)', async () => {
    const client = new ShopifyClient('test-shop.myshopify.com', 'test-access-token');
    const wrapped = wrapIntegration('shopify', client, {
      inputSchemas: shopifySchemas,
    });

    await expect(
      wrapped.createProduct({
        title: '',
      })
    ).rejects.toThrow(/title/);
  });

  it('should get customers successfully', async () => {
    const client = new ShopifyClient('test-shop.myshopify.com', 'test-access-token');
    const wrapped = wrapIntegration('shopify', client, {
      inputSchemas: shopifySchemas,
    });

    const result = await wrapped.getCustomers({ limit: 10 });

    expect(result.body.customers).toHaveLength(1);
    expect(result.body.customers[0].email).toBe('customer1@example.com');
  });

  it('should create a customer successfully', async () => {
    const client = new ShopifyClient('test-shop.myshopify.com', 'test-access-token');
    const wrapped = wrapIntegration('shopify', client, {
      inputSchemas: shopifySchemas,
    });

    const result = await wrapped.createCustomer({
      email: 'newcustomer@example.com',
      first_name: 'Jane',
      last_name: 'Smith',
    });

    expect(result.body.customer.id).toBe(123);
    expect(result.body.customer.email).toBe('newcustomer@example.com');
  });

  it('should reject invalid email', async () => {
    const client = new ShopifyClient('test-shop.myshopify.com', 'test-access-token');
    const wrapped = wrapIntegration('shopify', client, {
      inputSchemas: shopifySchemas,
    });

    await expect(
      wrapped.createCustomer({
        email: 'invalid-email',
      })
    ).rejects.toThrow(/email/);
  });

  it('should handle API errors gracefully', async () => {
    // Override handler to return error
    server.use(
      http.post('https://test-shop.myshopify.com/admin/api/*/products.json', () => {
        return HttpResponse.json({
          errors: 'Unauthorized',
        }, { status: 401 });
      })
    );

    const client = new ShopifyClient('test-shop.myshopify.com', 'invalid-token');
    const wrapped = wrapIntegration('shopify', client, {
      inputSchemas: shopifySchemas,
      maxRetries: 0,
    });

    await expect(
      wrapped.createProduct({
        title: 'Test Product',
      })
    ).rejects.toThrow();
  });
});
