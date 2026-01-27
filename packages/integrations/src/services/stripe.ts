/**
 * Stripe Integration
 *
 * Payment processing and subscription management.
 * API Docs: https://stripe.com/docs/api
 * SDK: https://github.com/stripe/stripe-node
 */

import { ToolConfig, SDKInitializer } from '@marktoflow/core';
import Stripe from 'stripe';

// Re-export Stripe types for convenience
export type StripeCustomer = Stripe.Customer;
export type StripePaymentIntent = Stripe.PaymentIntent;
export type StripeSubscription = Stripe.Subscription;
export type StripeInvoice = Stripe.Invoice;
export type StripeProduct = Stripe.Product;
export type StripePrice = Stripe.Price;
export type StripeCharge = Stripe.Charge;
export type StripeRefund = Stripe.Refund;

export interface CreateCustomerOptions {
  email?: string;
  name?: string;
  phone?: string;
  description?: string;
  metadata?: Record<string, string>;
  payment_method?: string;
}

export interface CreatePaymentIntentOptions {
  amount: number;
  currency: string;
  customer?: string;
  description?: string;
  metadata?: Record<string, string>;
  payment_method?: string;
  confirm?: boolean;
  automatic_payment_methods?: {
    enabled: boolean;
  };
}

export interface CreateSubscriptionOptions {
  customer: string;
  items: Array<{
    price: string;
    quantity?: number;
  }>;
  metadata?: Record<string, string>;
  trial_period_days?: number;
  default_payment_method?: string;
}

export interface CreateInvoiceOptions {
  customer: string;
  description?: string;
  metadata?: Record<string, string>;
  auto_advance?: boolean;
}

/**
 * Stripe client for workflow integration
 */
export class StripeClient {
  private stripe: Stripe;

  constructor(apiKey: string, config?: { apiVersion?: string }) {
    this.stripe = new Stripe(apiKey, {
      apiVersion: (config?.apiVersion as Stripe.LatestApiVersion) || '2024-12-18.acacia',
      typescript: true,
    });
  }

  // ==================== Customers ====================

  /**
   * Create a new customer
   */
  async createCustomer(options: CreateCustomerOptions): Promise<StripeCustomer> {
    return await this.stripe.customers.create(options);
  }

  /**
   * Retrieve a customer by ID
   */
  async getCustomer(customerId: string): Promise<StripeCustomer> {
    return await this.stripe.customers.retrieve(customerId) as Stripe.Customer;
  }

  /**
   * Update a customer
   */
  async updateCustomer(customerId: string, options: Partial<CreateCustomerOptions>): Promise<StripeCustomer> {
    return await this.stripe.customers.update(customerId, options);
  }

  /**
   * Delete a customer
   */
  async deleteCustomer(customerId: string): Promise<{ id: string; deleted: boolean }> {
    return await this.stripe.customers.del(customerId);
  }

  /**
   * List customers
   */
  async listCustomers(options?: {
    email?: string;
    limit?: number;
    starting_after?: string;
  }): Promise<{ data: StripeCustomer[]; has_more: boolean }> {
    return await this.stripe.customers.list(options);
  }

  // ==================== Payment Intents ====================

  /**
   * Create a payment intent
   */
  async createPaymentIntent(options: CreatePaymentIntentOptions): Promise<StripePaymentIntent> {
    return await this.stripe.paymentIntents.create(options);
  }

  /**
   * Retrieve a payment intent
   */
  async getPaymentIntent(paymentIntentId: string): Promise<StripePaymentIntent> {
    return await this.stripe.paymentIntents.retrieve(paymentIntentId);
  }

  /**
   * Confirm a payment intent
   */
  async confirmPaymentIntent(
    paymentIntentId: string,
    options?: { payment_method?: string }
  ): Promise<StripePaymentIntent> {
    return await this.stripe.paymentIntents.confirm(paymentIntentId, options);
  }

  /**
   * Cancel a payment intent
   */
  async cancelPaymentIntent(paymentIntentId: string): Promise<StripePaymentIntent> {
    return await this.stripe.paymentIntents.cancel(paymentIntentId);
  }

  /**
   * List payment intents
   */
  async listPaymentIntents(options?: {
    customer?: string;
    limit?: number;
    starting_after?: string;
  }): Promise<{ data: StripePaymentIntent[]; has_more: boolean }> {
    return await this.stripe.paymentIntents.list(options);
  }

  // ==================== Subscriptions ====================

  /**
   * Create a subscription
   */
  async createSubscription(options: CreateSubscriptionOptions): Promise<StripeSubscription> {
    return await this.stripe.subscriptions.create(options);
  }

  /**
   * Retrieve a subscription
   */
  async getSubscription(subscriptionId: string): Promise<StripeSubscription> {
    return await this.stripe.subscriptions.retrieve(subscriptionId);
  }

  /**
   * Update a subscription
   */
  async updateSubscription(
    subscriptionId: string,
    options: Partial<CreateSubscriptionOptions>
  ): Promise<StripeSubscription> {
    return await this.stripe.subscriptions.update(subscriptionId, options);
  }

  /**
   * Cancel a subscription
   */
  async cancelSubscription(
    subscriptionId: string,
    options?: { prorate?: boolean; invoice_now?: boolean }
  ): Promise<StripeSubscription> {
    return await this.stripe.subscriptions.cancel(subscriptionId, options);
  }

  /**
   * List subscriptions
   */
  async listSubscriptions(options?: {
    customer?: string;
    status?: 'active' | 'canceled' | 'incomplete' | 'past_due' | 'trialing' | 'unpaid';
    limit?: number;
    starting_after?: string;
  }): Promise<{ data: StripeSubscription[]; has_more: boolean }> {
    return await this.stripe.subscriptions.list(options);
  }

  // ==================== Invoices ====================

  /**
   * Create an invoice
   */
  async createInvoice(options: CreateInvoiceOptions): Promise<StripeInvoice> {
    return await this.stripe.invoices.create(options);
  }

  /**
   * Retrieve an invoice
   */
  async getInvoice(invoiceId: string): Promise<StripeInvoice> {
    return await this.stripe.invoices.retrieve(invoiceId);
  }

  /**
   * Finalize an invoice
   */
  async finalizeInvoice(invoiceId: string): Promise<StripeInvoice> {
    return await this.stripe.invoices.finalizeInvoice(invoiceId);
  }

  /**
   * Pay an invoice
   */
  async payInvoice(invoiceId: string): Promise<StripeInvoice> {
    return await this.stripe.invoices.pay(invoiceId);
  }

  /**
   * Send an invoice
   */
  async sendInvoice(invoiceId: string): Promise<StripeInvoice> {
    return await this.stripe.invoices.sendInvoice(invoiceId);
  }

  /**
   * List invoices
   */
  async listInvoices(options?: {
    customer?: string;
    status?: 'draft' | 'open' | 'paid' | 'uncollectible' | 'void';
    limit?: number;
    starting_after?: string;
  }): Promise<{ data: StripeInvoice[]; has_more: boolean }> {
    return await this.stripe.invoices.list(options);
  }

  // ==================== Products & Prices ====================

  /**
   * Create a product
   */
  async createProduct(options: {
    name: string;
    description?: string;
    metadata?: Record<string, string>;
  }): Promise<Stripe.Product> {
    return await this.stripe.products.create(options);
  }

  /**
   * Create a price
   */
  async createPrice(options: {
    product: string;
    unit_amount: number;
    currency: string;
    recurring?: {
      interval: 'day' | 'week' | 'month' | 'year';
      interval_count?: number;
    };
    metadata?: Record<string, string>;
  }): Promise<Stripe.Price> {
    return await this.stripe.prices.create(options);
  }

  /**
   * List products
   */
  async listProducts(options?: {
    active?: boolean;
    limit?: number;
    starting_after?: string;
  }): Promise<{ data: Stripe.Product[]; has_more: boolean }> {
    return await this.stripe.products.list(options);
  }

  /**
   * List prices
   */
  async listPrices(options?: {
    product?: string;
    active?: boolean;
    limit?: number;
    starting_after?: string;
  }): Promise<{ data: Stripe.Price[]; has_more: boolean }> {
    return await this.stripe.prices.list(options);
  }

  // ==================== Charges ====================

  /**
   * Retrieve a charge
   */
  async getCharge(chargeId: string): Promise<Stripe.Charge> {
    return await this.stripe.charges.retrieve(chargeId);
  }

  /**
   * List charges
   */
  async listCharges(options?: {
    customer?: string;
    limit?: number;
    starting_after?: string;
  }): Promise<{ data: Stripe.Charge[]; has_more: boolean }> {
    return await this.stripe.charges.list(options);
  }

  // ==================== Refunds ====================

  /**
   * Create a refund
   */
  async createRefund(options: {
    charge?: string;
    payment_intent?: string;
    amount?: number;
    reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer';
    metadata?: Record<string, string>;
  }): Promise<Stripe.Refund> {
    return await this.stripe.refunds.create(options);
  }

  /**
   * Retrieve a refund
   */
  async getRefund(refundId: string): Promise<Stripe.Refund> {
    return await this.stripe.refunds.retrieve(refundId);
  }

  /**
   * List refunds
   */
  async listRefunds(options?: {
    charge?: string;
    payment_intent?: string;
    limit?: number;
    starting_after?: string;
  }): Promise<{ data: Stripe.Refund[]; has_more: boolean }> {
    return await this.stripe.refunds.list(options);
  }

  // ==================== Webhooks ====================

  /**
   * Construct a webhook event from raw body and signature
   */
  constructWebhookEvent(payload: string | Buffer, signature: string, secret: string): Stripe.Event {
    return this.stripe.webhooks.constructEvent(payload, signature, secret);
  }
}

export const StripeInitializer: SDKInitializer = {
  async initialize(_module: unknown, config: ToolConfig): Promise<unknown> {
    const apiKey = config.auth?.['api_key'] as string | undefined;
    if (!apiKey) {
      throw new Error('Stripe SDK requires auth.api_key');
    }

    const apiVersion = config.options?.['api_version'] as string | undefined;

    const client = new StripeClient(apiKey, { apiVersion });
    return {
      client,
      actions: client,
    };
  },
};
