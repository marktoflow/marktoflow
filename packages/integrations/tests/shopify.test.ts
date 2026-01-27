import { describe, it, expect } from 'vitest';
import { SDKRegistry } from '@marktoflow/core';
import { registerIntegrations, ShopifyInitializer, ShopifyClient } from '../src/index.js';

describe('Shopify Integration', () => {
  it('should register shopify initializer', () => {
    const registry = new SDKRegistry();
    registerIntegrations(registry);

    const config = {
      sdk: '@shopify/shopify-api',
      auth: {
        shop: 'test-shop.myshopify.com',
        access_token: 'test_token_123',
      },
    };

    const result = ShopifyInitializer.initialize({}, config);
    expect(result).toBeInstanceOf(Promise);

    return expect(result).resolves.toHaveProperty('client');
  });

  it('should throw if shop is missing', async () => {
    const config = {
      sdk: '@shopify/shopify-api',
      auth: { access_token: 'test_token_123' },
    };

    await expect(ShopifyInitializer.initialize({}, config)).rejects.toThrow('shop');
  });

  it('should throw if access_token is missing', async () => {
    const config = {
      sdk: '@shopify/shopify-api',
      auth: { shop: 'test-shop.myshopify.com' },
    };

    await expect(ShopifyInitializer.initialize({}, config)).rejects.toThrow('access_token');
  });

  it('should create ShopifyClient', async () => {
    const config = {
      sdk: '@shopify/shopify-api',
      auth: {
        shop: 'test-shop.myshopify.com',
        access_token: 'test_token_123',
      },
    };

    const result = await ShopifyInitializer.initialize({}, config);
    expect(result).toHaveProperty('client');
    expect((result as { client: ShopifyClient }).client).toBeInstanceOf(ShopifyClient);
  });
});
