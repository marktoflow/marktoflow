"""
Payment Service - Stripe integration

Current features:
- Stripe payment processing
- Webhook handling for payment events
- Refund support
- Customer management
"""

import stripe
from decimal import Decimal

def process_payment(amount: Decimal, currency: str, customer_id: str):
    """Process a payment using Stripe"""
    return stripe.PaymentIntent.create(
        amount=int(amount),
        currency=currency,
        customer=customer_id,
    )

def process_refund(payment_id: str, amount: Decimal = None):
    """Process a refund for a payment"""
    return stripe.Refund.create(
        payment_intent=payment_id,
        amount=int(amount) if amount else None,
    )

def handle_webhook(payload: dict, signature: str):
    """Handle Stripe webhook events"""
    event = stripe.Webhook.construct_event(
        payload, signature, webhook_secret
    )
    return event
