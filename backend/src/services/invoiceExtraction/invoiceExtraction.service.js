const placeholderInvoiceExtractionProvider = require("./providers/placeholderInvoiceExtraction.provider");

const EXTRACTION_STATUSES = ["not_started", "completed", "incomplete", "failed", "reviewed"];
const EXTRACTION_CONFIDENCE_LEVELS = ["low", "medium", "high"];

function normalizeField(field) {
  if (!field || typeof field !== "object" || Array.isArray(field)) {
    return {
      value: field ?? null,
      confidence: field == null ? "low" : "medium",
      source: null
    };
  }

  return {
    value: field.value ?? null,
    confidence: EXTRACTION_CONFIDENCE_LEVELS.includes(field.confidence) ? field.confidence : "low",
    source: field.source || null
  };
}

function normalizeResult(providerId, result, context) {
  const fields = result?.fields && typeof result.fields === "object" ? result.fields : {};

  return {
    providerId,
    providerVersion: result?.providerVersion || "unknown",
    extractionStatus: EXTRACTION_STATUSES.includes(result?.extractionStatus)
      ? result.extractionStatus
      : "failed",
    overallConfidence: EXTRACTION_CONFIDENCE_LEVELS.includes(result?.overallConfidence)
      ? result.overallConfidence
      : "low",
    fields: {
      invoiceNumber: normalizeField(fields.invoiceNumber),
      invoiceDate: normalizeField(fields.invoiceDate),
      dueDate: normalizeField(fields.dueDate),
      subtotal: normalizeField(fields.subtotal),
      tax: normalizeField(fields.tax),
      total: normalizeField(fields.total),
      currency: normalizeField(fields.currency)
    },
    notes: Array.isArray(result?.notes) ? result.notes.filter(Boolean) : [],
    source: {
      attachment: {
        index: context.attachmentIndex,
        fileName: context?.attachment?.originalFileName || context?.attachment?.fileName || null,
        mimeType: context?.attachment?.mimeType || null,
        storagePath: context?.attachment?.storagePath || null
      },
      email: {
        senderEmail: context?.invoiceMessage?.senderEmail || null,
        senderName: context?.invoiceMessage?.senderName || null,
        subject: context?.invoiceMessage?.subject || null,
        messageId: context?.invoiceMessage?.messageId || null,
        receivedAt: context?.invoiceMessage?.receivedAt || null
      },
      supplierMatch: {
        supplierId: context?.supplierResolution?.supplierId || null,
        strategy: context?.supplierResolution?.supplierMatchStrategy || null
      }
    }
  };
}

function createInvoiceExtractionService({
  providers = [placeholderInvoiceExtractionProvider],
  defaultProviderId = placeholderInvoiceExtractionProvider.id
} = {}) {
  const providerRegistry = new Map(
    providers.map((provider) => [provider.id, provider])
  );

  async function extractImportedInvoiceFile(context, providerId = defaultProviderId) {
    const provider = providerRegistry.get(providerId);

    if (!provider) {
      throw new Error(`Unknown invoice extraction provider: ${providerId}`);
    }

    const extractionResult = await provider.extract(context);
    return normalizeResult(providerId, extractionResult, context);
  }

  return {
    extractImportedInvoiceFile
  };
}

const defaultInvoiceExtractionService = createInvoiceExtractionService();

module.exports = {
  EXTRACTION_CONFIDENCE_LEVELS,
  EXTRACTION_STATUSES,
  createInvoiceExtractionService,
  defaultInvoiceExtractionService
};
