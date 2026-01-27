/**
 * Shopify Integration
 *
 * E-commerce platform for online stores.
 * API Docs: https://shopify.dev/docs/api
 * SDK: https://github.com/Shopify/shopify-api-js
 */

import { shopifyApi, Session, LATEST_API_VERSION } from '@shopify/shopify-api';
import '@shopify/shopify-api/adapters/node';
import { ToolConfig, SDKInitializer } from '@marktoflow/core';

export interface ShopifyProduct {
  id?: string;
  title: string;
  body_html?: string;
  vendor?: string;
  product_type?: string;
  tags?: string;
  variants?: Array<{
    id?: string;
    price: string;
    sku?: string;
    inventory_quantity?: number;
  }>;
}

export interface ShopifyOrder {
  id?: string;
  email?: string;
  total_price?: string;
  line_items?: Array<{
    product_id?: string;
    variant_id?: string;
    quantity: number;
    price?: string;
  }>;
  customer?: {
    id?: string;
    email?: string;
    first_name?: string;
    last_name?: string;
  };
  shipping_address?: {
    address1?: string;
    city?: string;
    province?: string;
    country?: string;
    zip?: string;
  };
}

export interface ShopifyCustomer {
  id?: string;
  email: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  tags?: string;
  addresses?: Array<{
    address1?: string;
    city?: string;
    province?: string;
    country?: string;
    zip?: string;
  }>;
}

/**
 * Shopify client wrapper for workflow integration
 */
export class ShopifyClient {
  private shopify: ReturnType<typeof shopifyApi>;
  private session: Session;

  constructor(shop: string, accessToken: string) {
    this.shopify = shopifyApi({
      apiKey: 'not-needed-for-custom-app',
      apiSecretKey: 'not-needed-for-custom-app',
      scopes: [],
      hostName: shop,
      apiVersion: LATEST_API_VERSION,
      isEmbeddedApp: false,
    });

    this.session = this.shopify.session.customAppSession(shop);
    this.session.accessToken = accessToken;
  }

  // ==================== Products ====================

  /**
   * Get products
   */
  async getProducts(options?: { limit?: number; since_id?: string }) {
    const client = new this.shopify.clients.Rest({ session: this.session });
    return await client.get({ path: 'products', query: options });
  }

  /**
   * Get product by ID
   */
  async getProduct(productId: string) {
    const client = new this.shopify.clients.Rest({ session: this.session });
    return await client.get({ path: `products/${productId}` });
  }

  /**
   * Create product
   */
  async createProduct(product: ShopifyProduct) {
    const client = new this.shopify.clients.Rest({ session: this.session });
    return await client.post({ path: 'products', data: { product } });
  }

  /**
   * Update product
   */
  async updateProduct(productId: string, product: Partial<ShopifyProduct>) {
    const client = new this.shopify.clients.Rest({ session: this.session });
    return await client.put({ path: `products/${productId}`, data: { product } });
  }

  /**
   * Delete product
   */
  async deleteProduct(productId: string) {
    const client = new this.shopify.clients.Rest({ session: this.session });
    return await client.delete({ path: `products/${productId}` });
  }

  // ==================== Orders ====================

  /**
   * Get orders
   */
  async getOrders(options?: { status?: string; limit?: number; since_id?: string }) {
    const client = new this.shopify.clients.Rest({ session: this.session });
    return await client.get({ path: 'orders', query: options });
  }

  /**
   * Get order by ID
   */
  async getOrder(orderId: string) {
    const client = new this.shopify.clients.Rest({ session: this.session });
    return await client.get({ path: `orders/${orderId}` });
  }

  /**
   * Create order
   */
  async createOrder(order: ShopifyOrder) {
    const client = new this.shopify.clients.Rest({ session: this.session });
    return await client.post({ path: 'orders', data: { order } });
  }

  /**
   * Update order
   */
  async updateOrder(orderId: string, order: Partial<ShopifyOrder>) {
    const client = new this.shopify.clients.Rest({ session: this.session });
    return await client.put({ path: `orders/${orderId}`, data: { order } });
  }

  /**
   * Cancel order
   */
  async cancelOrder(orderId: string, options?: { reason?: string; email?: boolean }) {
    const client = new this.shopify.clients.Rest({ session: this.session });
    return await client.post({ path: `orders/${orderId}/cancel`, data: options || {} });
  }

  // ==================== Customers ====================

  /**
   * Get customers
   */
  async getCustomers(options?: { limit?: number; since_id?: string }) {
    const client = new this.shopify.clients.Rest({ session: this.session });
    return await client.get({ path: 'customers', query: options });
  }

  /**
   * Get customer by ID
   */
  async getCustomer(customerId: string) {
    const client = new this.shopify.clients.Rest({ session: this.session });
    return await client.get({ path: `customers/${customerId}` });
  }

  /**
   * Create customer
   */
  async createCustomer(customer: ShopifyCustomer) {
    const client = new this.shopify.clients.Rest({ session: this.session });
    return await client.post({ path: 'customers', data: { customer } });
  }

  /**
   * Update customer
   */
  async updateCustomer(customerId: string, customer: Partial<ShopifyCustomer>) {
    const client = new this.shopify.clients.Rest({ session: this.session });
    return await client.put({ path: `customers/${customerId}`, data: { customer } });
  }

  /**
   * Delete customer
   */
  async deleteCustomer(customerId: string) {
    const client = new this.shopify.clients.Rest({ session: this.session });
    return await client.delete({ path: `customers/${customerId}` });
  }

  // ==================== Inventory ====================

  /**
   * Get inventory levels
   */
  async getInventoryLevels(options: { inventory_item_ids?: string; location_ids?: string }) {
    const client = new this.shopify.clients.Rest({ session: this.session });
    return await client.get({ path: 'inventory_levels', query: options });
  }

  /**
   * Update inventory level
   */
  async updateInventoryLevel(options: {
    location_id: string;
    inventory_item_id: string;
    available: number;
  }) {
    const client = new this.shopify.clients.Rest({ session: this.session });
    return await client.post({ path: 'inventory_levels/set', data: options });
  }
}

export const ShopifyInitializer: SDKInitializer = {
  async initialize(_module: unknown, config: ToolConfig): Promise<unknown> {
    const shop = config.auth?.['shop'] as string | undefined;
    const accessToken = config.auth?.['access_token'] as string | undefined;

    if (!shop || !accessToken) {
      throw new Error('Shopify SDK requires auth.shop and auth.access_token');
    }

    const client = new ShopifyClient(shop, accessToken);

    return {
      client,
      actions: client,
    };
  },
};
