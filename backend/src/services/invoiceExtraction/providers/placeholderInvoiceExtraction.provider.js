const PROVIDER_ID = "placeholder";
const PROVIDER_VERSION = "placeholder-v1";

function normalizeWhitespace(value) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function normalizeMoney(value) {
  if (!value) {
    return null;
  }

  const normalized = String(value).replace(/,/g, "");
  const parsedValue = Number(normalized);

  if (!Number.isFinite(parsedValue) || parsedValue < 0) {
    return null;
  }

  return parsedValue.toFixed(2);
}

function extractDateValue(rawValue) {
  if (!rawValue) {
    return null;
  }

  const normalized = rawValue.replace(/[_.]/g, "-");

  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return normalized;
  }

  const dayFirstMatch = normalized.match(/^(\d{2})-(\d{2})-(\d{4})$/);

  if (!dayFirstMatch) {
    return null;
  }

  const [, day, month, year] = dayFirstMatch;
  return `${year}-${month}-${day}`;
}

function extractDateFromText(text, pattern) {
  if (!text) {
    return null;
  }

  const match = text.match(pattern);

  if (!match) {
    return null;
  }

  return extractDateValue(match[1]);
}

function buildField(value = null, confidence = "low", source = null) {
  return {
    value,
    confidence,
    source
  };
}

function inferInvoiceNumber(text) {
  if (!text) {
    return buildField();
  }

  const keywordMatch = text.match(/\b(?:invoice|inv)[\s#:._-]*([A-Z0-9][A-Z0-9._/-]{2,})\b/i);

  if (keywordMatch) {
    return buildField(keywordMatch[1].replace(/[._/]+$/g, ""), "low", "file_name_or_subject");
  }

  return buildField();
}

function inferInvoiceDate(text) {
  const directDate =
    extractDateFromText(text, /\b(\d{4}[-_.]\d{2}[-_.]\d{2})\b/) ||
    extractDateFromText(text, /\b(\d{2}[-_.]\d{2}[-_.]\d{4})\b/);

  if (directDate) {
    return buildField(directDate, "low", "file_name_or_subject");
  }

  return buildField();
}

function inferDueDate(text) {
  const dueDate =
    extractDateFromText(
      text,
      /\bdue(?:\s+date)?[^\d]{0,10}(\d{4}[-_.]\d{2}[-_.]\d{2}|\d{2}[-_.]\d{2}[-_.]\d{4})\b/i
    ) || null;

  if (dueDate) {
    return buildField(dueDate, "low", "file_name_or_subject");
  }

  return buildField();
}

function inferMoneyField(text, labelPattern) {
  if (!text) {
    return buildField();
  }

  const match = text.match(labelPattern);

  if (!match) {
    return buildField();
  }

  return buildField(normalizeMoney(match[1]), "low", "file_name_or_subject");
}

function inferCurrency(text, supplierResolution) {
  const explicitCurrency = text.match(/\b(USD|AUD|NZD|EUR|GBP|CAD|SGD)\b/i);

  if (explicitCurrency) {
    return buildField(explicitCurrency[1].toUpperCase(), "low", "file_name_or_subject");
  }

  if (supplierResolution?.defaultCurrency) {
    return buildField(supplierResolution.defaultCurrency, "low", "supplier_default");
  }

  return buildField("USD", "low", "fallback_default");
}

function buildNotes(completedFieldCount) {
  const notes = ["Placeholder extraction used filename and email subject heuristics only."];

  if (completedFieldCount === 0) {
    notes.push("No invoice fields could be reliably inferred from the imported file metadata.");
  } else {
    notes.push("Review extracted values carefully before approval.");
  }

  notes.push("OCR and AI providers can be plugged into the extraction service later.");

  return notes;
}

async function extract(context) {
  const sourceText = normalizeWhitespace(
    [
      context?.attachment?.originalFileName,
      context?.attachment?.fileName,
      context?.invoiceMessage?.subject
    ]
      .filter(Boolean)
      .join(" ")
  );

  const fields = {
    invoiceNumber: inferInvoiceNumber(sourceText),
    invoiceDate: inferInvoiceDate(sourceText),
    dueDate: inferDueDate(sourceText),
    subtotal: inferMoneyField(
      sourceText,
      /\bsubtotal[^\d]{0,10}(\d[\d,]*(?:\.\d{2})?)\b/i
    ),
    tax: inferMoneyField(sourceText, /\b(?:tax|gst|vat)[^\d]{0,10}(\d[\d,]*(?:\.\d{2})?)\b/i),
    total: inferMoneyField(
      sourceText,
      /\b(?:total|amount due)[^\d]{0,10}(\d[\d,]*(?:\.\d{2})?)\b/i
    ),
    currency: inferCurrency(sourceText, context?.supplierResolution)
  };

  const populatedFieldCount = Object.values(fields).filter((field) => field.value !== null).length;
  const hasRequiredCoverage =
    fields.invoiceNumber.value !== null &&
    fields.invoiceDate.value !== null &&
    fields.total.value !== null;

  return {
    providerId: PROVIDER_ID,
    providerVersion: PROVIDER_VERSION,
    extractionStatus: hasRequiredCoverage ? "completed" : "incomplete",
    overallConfidence: hasRequiredCoverage ? "medium" : "low",
    fields,
    notes: buildNotes(populatedFieldCount)
  };
}

module.exports = {
  id: PROVIDER_ID,
  extract
};
