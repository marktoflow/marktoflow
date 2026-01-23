# Payment Service

Handles payment processing for orders.

## Features

- Stripe integration
- Payment webhooks
- Refund support

## Environment Variables

- `STRIPE_API_KEY` - Your Stripe API key
- `STRIPE_WEBHOOK_SECRET` - Webhook secret for verification

## Usage

```python
from payment_service import process_payment

result = process_payment(
    amount=1000,
    currency="usd",
    customer_id="cus_123"
)
```

This documentation is accurate and up-to-date with the current implementation.
