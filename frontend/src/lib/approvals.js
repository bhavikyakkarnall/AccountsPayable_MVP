import { apiRequest } from "./api";

export const APPROVAL_ACTION_LABELS = {
  submitted: "Submitted",
  approve: "Approved",
  reject: "Rejected",
  send_back: "Sent Back"
};

export async function fetchApprovalQueue() {
  const response = await apiRequest("/approvals/queue");
  return response.data;
}

export async function fetchApprovalWorkflows() {
  const response = await apiRequest("/approvals/workflows");
  return response.data;
}

export async function submitInvoiceForApproval(invoiceId) {
  const response = await apiRequest(`/approvals/invoices/${invoiceId}/submit`, {
    method: "POST"
  });

  return response.data;
}

export async function submitApprovalDecision(invoiceId, payload) {
  const response = await apiRequest(`/approvals/invoices/${invoiceId}/decision`, {
    method: "POST",
    body: JSON.stringify(payload)
  });

  return response.data;
}
