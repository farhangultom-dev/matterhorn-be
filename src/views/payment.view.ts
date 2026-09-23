import type { PaymentCheckout } from '../services/payment.service';

export const presentPaymentCheckout = (checkout: PaymentCheckout) => ({
  order: {
    id: checkout.order.id,
    status: checkout.order.status,
    subtotalAmount: checkout.order.subtotal_amount,
    feeAmount: checkout.order.fee_amount,
    totalAmount: checkout.order.total_amount,
    items: checkout.items.map((item) => ({
      eventTicketTypeId: item.event_ticket_type_id,
      quantity: item.quantity,
      unitPrice: item.unit_price,
      subtotal: item.subtotal,
    })),
  },
  payment: {
    id: checkout.payment.id,
    provider: checkout.payment.provider,
    providerReference: checkout.payment.provider_reference,
    merchantReference: checkout.payment.merchant_reference,
    status: checkout.payment.status,
    initiationStatus: checkout.payment.initiation_state,
    amount: checkout.payment.amount,
    providerFeeAmount: checkout.payment.provider_fee_amount,
    providerNetAmount: checkout.payment.provider_net_amount,
    paymentLinkUrl: checkout.payment.payment_link_url,
    expiresAt: checkout.payment.expires_at === null ? null : new Date(checkout.payment.expires_at).toISOString(),
  },
});
