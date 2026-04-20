import { apiRequest } from "./api";

export const INVOICE_STATUSES = [
  "draft",
  "new",
  "needs_review",
  "in_review",
  "pending_approval",
  "approved",
  "rejected",
  "sent_back",
  "on_hold",
  "duplicate",
  "paid"
];

export const STATUS_LABELS = {
  draft: "Draft",
  new: "New",
  needs_review: "Needs Review",
  in_review: "In Review",
  pending_approval: "Pending Approval",
  approved: "Approved",
  rejected: "Rejected",
  sent_back: "Sent Back",
  on_hold: "On Hold",
  duplicate: "Duplicate",
  paid: "Paid"
};

export const MANUAL_INVOICE_STATUSES = [
  "draft",
  "new",
  "needs_review",
  "in_review",
  "on_hold",
  "duplicate"
];

export const EXTRACTION_STATUS_LABELS = {
  not_started: "Not Started",
  completed: "Completed",
  incomplete: "Incomplete",
  failed: "Failed",
  reviewed: "Reviewed"
};

export const EXTRACTION_CONFIDENCE_LABELS = {
  low: "Low",
  medium: "Medium",
  high: "High"
};

export function createEmptyInvoiceForm() {
  return {
    supplierId: "",
    invoiceNumber: "",
    invoiceDate: "",
    dueDate: "",
    subtotal: "",
    tax: "",
    total: "",
    currency: "USD",
    externalPoNumber: "",
    externalPoVerified: false,
    verificationNotes: "",
    assignedUserId: "",
    status: "draft",
    duplicateFlag: false,
    holdReason: "",
    attachmentMetadata: []
  };
}

export async function fetchInvoices(filters = {}) {
  const searchParams = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value !== "" && value !== null && value !== undefined) {
      searchParams.set(key, value);
    }
  });

  const queryString = searchParams.toString();
  const response = await apiRequest(`/invoices${queryString ? `?${queryString}` : ""}`);

  return response.data;
}

export async function fetchInvoiceMeta() {
  const response = await apiRequest("/invoices/meta");
  return response.data;
}

export async function fetchInvoiceById(invoiceId) {
  const response = await apiRequest(`/invoices/${invoiceId}`);
  return response.data;
}

export async function createInvoice(payload) {
  const response = await apiRequest("/invoices", {
    method: "POST",
    body: JSON.stringify(payload)
  });

  return response.data;
}

export async function updateInvoice(invoiceId, payload) {
  const response = await apiRequest(`/invoices/${invoiceId}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });

  return response.data;
}

export async function deleteInvoice(invoiceId) {
  await apiRequest(`/invoices/${invoiceId}`, {
    method: "DELETE"
  });
}

export async function createInvoiceComment(invoiceId, payload) {
  const response = await apiRequest(`/invoices/${invoiceId}/comments`, {
    method: "POST",
    body: JSON.stringify(payload)
  });

  return response.data;
}

export function toInvoiceForm(invoice) {
  return {
    supplierId: invoice?.supplierId ? String(invoice.supplierId) : "",
    invoiceNumber: invoice?.invoiceNumber || "",
    invoiceDate: invoice?.invoiceDate || "",
    dueDate: invoice?.dueDate || "",
    subtotal:
      invoice?.subtotal === null || invoice?.subtotal === undefined
        ? ""
        : invoice?.subtotal?.toFixed?.(2) || String(invoice.subtotal),
    tax:
      invoice?.tax === null || invoice?.tax === undefined
        ? ""
        : invoice?.tax?.toFixed?.(2) || String(invoice.tax),
    total:
      invoice?.total === null || invoice?.total === undefined
        ? ""
        : invoice?.total?.toFixed?.(2) || String(invoice.total),
    currency: invoice?.currency || "USD",
    externalPoNumber: invoice?.externalPoNumber || "",
    externalPoVerified: Boolean(invoice?.externalPoVerified),
    verificationNotes: invoice?.verificationNotes || "",
    assignedUserId: invoice?.assignedUserId ? String(invoice.assignedUserId) : "",
    status: invoice?.status || "draft",
    duplicateFlag: Boolean(invoice?.duplicateFlag),
    holdReason: invoice?.holdReason || "",
    attachmentMetadata: Array.isArray(invoice?.attachmentMetadata)
      ? invoice.attachmentMetadata.map((attachment) => ({
          fileName: attachment.fileName || "",
          originalFileName: attachment.originalFileName || "",
          mimeType: attachment.mimeType || "",
          fileSizeBytes:
            attachment.fileSizeBytes === undefined || attachment.fileSizeBytes === null
              ? ""
              : String(attachment.fileSizeBytes),
          fileChecksumSha256: attachment.fileChecksumSha256 || "",
          storageProvider: attachment.storageProvider || "local",
          storagePath: attachment.storagePath || "",
          isPrimaryDocument: attachment.isPrimaryDocument !== false,
          uploadedAt: attachment.uploadedAt || ""
        }))
      : []
  };
}

export function toInvoicePayload(formState) {
  return {
    supplierId: Number(formState.supplierId),
    invoiceNumber: formState.invoiceNumber || null,
    invoiceDate: formState.invoiceDate || null,
    dueDate: formState.dueDate || null,
    subtotal: formState.subtotal === "" ? null : Number(formState.subtotal),
    tax: formState.tax === "" ? null : Number(formState.tax),
    total: formState.total === "" ? null : Number(formState.total),
    currency: formState.currency,
    externalPoNumber: formState.externalPoNumber || null,
    externalPoVerified: Boolean(formState.externalPoVerified),
    verificationNotes: formState.verificationNotes || null,
    assignedUserId: formState.assignedUserId ? Number(formState.assignedUserId) : null,
    status: formState.status,
    duplicateFlag: Boolean(formState.duplicateFlag),
    holdReason: formState.holdReason || null,
    attachmentMetadata: formState.attachmentMetadata.map((attachment) => ({
      fileName: attachment.fileName,
      originalFileName: attachment.originalFileName || attachment.fileName,
      mimeType: attachment.mimeType,
      fileSizeBytes: Number(attachment.fileSizeBytes),
      fileChecksumSha256: attachment.fileChecksumSha256 || null,
      storageProvider: attachment.storageProvider || "local",
      storagePath: attachment.storagePath,
      isPrimaryDocument: Boolean(attachment.isPrimaryDocument),
      uploadedAt: attachment.uploadedAt || null
    }))
  };
}
