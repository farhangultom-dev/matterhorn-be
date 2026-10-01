import type { PaymentCheckout, PaymentOrderHistoryEntry } from '../services/payment.service';

const toIso = (value: Date | string | null): string | null => value === null ? null : new Date(value).toISOString();

const presentPayment = (payment: PaymentOrderHistoryEntry['payment']) => payment === null ? null : ({
  id: payment.id,
  provider: payment.provider,
  providerReference: payment.provider_reference,
  merchantReference: payment.merchant_reference,
  status: payment.status,
  initiationStatus: payment.initiation_state,
  amount: payment.amount,
  providerFeeAmount: payment.provider_fee_amount,
  providerNetAmount: payment.provider_net_amount,
  paymentLinkUrl: payment.payment_link_url,
  expiresAt: toIso(payment.expires_at),
  paidAt: toIso(payment.paid_at),
});

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

export const presentPaymentOrderHistoryEntry = (entry: PaymentOrderHistoryEntry) => ({
  id: entry.order.id,
  userId: entry.order.user_id,
  status: entry.order.status,
  subtotalAmount: entry.order.subtotal_amount,
  feeAmount: entry.order.fee_amount,
  totalAmount: entry.order.total_amount,
  createdAt: toIso(entry.order.created_at),
  paidAt: toIso(entry.order.paid_at),
  items: entry.items.map((item) => ({
    id: item.id,
    eventTicketTypeId: item.event_ticket_type_id,
    eventName: item.event_title,
    ticketTypeName: item.ticket_type_name,
    quantity: item.quantity,
    unitPrice: item.unit_price,
    subtotal: item.subtotal,
  })),
  payment: presentPayment(entry.payment),
});
