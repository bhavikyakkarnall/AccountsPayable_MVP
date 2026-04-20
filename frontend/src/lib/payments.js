import { apiRequest } from "./api";

export const PAYMENT_STATUSES = [
  "ready_for_payment",
  "payment_submitted",
  "paid",
  "payment_failed"
];

export const PAYMENT_STATUS_LABELS = {
  ready_for_payment: "Ready for Payment",
  payment_submitted: "Payment Submitted",
  paid: "Paid",
  payment_failed: "Payment Failed"
};

export const PAYMENT_STATUS_TRANSITIONS = {
  ready_for_payment: ["payment_submitted", "payment_failed", "paid"],
  payment_submitted: ["paid", "payment_failed"],
  payment_failed: ["ready_for_payment"],
  paid: []
};

export async function fetchPayments(filters = {}) {
  const searchParams = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value !== "" && value !== null && value !== undefined) {
      searchParams.set(key, value);
    }
  });

  const queryString = searchParams.toString();
  const response = await apiRequest(`/payments${queryString ? `?${queryString}` : ""}`);

  return response.data;
}

export async function fetchPaymentMeta() {
  const response = await apiRequest("/payments/meta");
  return response.data;
}

export async function createPayment(payload) {
  const response = await apiRequest("/payments", {
    method: "POST",
    body: JSON.stringify(payload)
  });

  return response.data;
}

export async function updatePayment(paymentId, payload) {
  const response = await apiRequest(`/payments/${paymentId}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });

  return response.data;
}

export function createEmptyPaymentForm(invoice = null) {
  return {
    invoiceId: invoice?.invoiceId ? String(invoice.invoiceId) : "",
    paymentStatus: "ready_for_payment",
    paymentReference: "",
    paymentDate: "",
    notes: "",
    amount:
      invoice?.totalAmount === undefined || invoice?.totalAmount === null
        ? ""
        : String(invoice.totalAmount),
    currency: invoice?.currency || "USD",
    paymentMethod: ""
  };
}

export function toPaymentPayload(formState) {
  return {
    invoiceId: Number(formState.invoiceId),
    paymentStatus: formState.paymentStatus,
    paymentReference: formState.paymentReference || null,
    paymentDate: formState.paymentDate || null,
    notes: formState.notes || null,
    amount: formState.amount === "" ? undefined : Number(formState.amount),
    currency: formState.currency || undefined,
    paymentMethod: formState.paymentMethod || null
  };
}

export function toPaymentUpdatePayload(formState) {
  return {
    paymentStatus: formState.paymentStatus,
    paymentReference: formState.paymentReference || null,
    paymentDate: formState.paymentDate || null,
    notes: formState.notes || null
  };
}

export function toPaymentForm(payment) {
  return {
    paymentStatus: payment.paymentStatus || "ready_for_payment",
    paymentReference: payment.paymentReference || "",
    paymentDate: payment.paymentDate || "",
    notes: payment.notes || ""
  };
}

export function getAllowedNextPaymentStatuses(currentStatus) {
  return [currentStatus, ...(PAYMENT_STATUS_TRANSITIONS[currentStatus] || [])];
}
