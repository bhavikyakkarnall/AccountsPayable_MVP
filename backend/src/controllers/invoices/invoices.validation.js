const ApiError = require("../../utils/ApiError");

const INVOICE_STATUSES = [
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

const PAYMENT_MANAGED_INVOICE_STATUSES = ["paid"];

const CURRENCY_REGEX = /^[A-Z]{3}$/;

function assertNonEmptyString(value, fieldName, errors, maxLength = 255) {
  if (typeof value !== "string" || value.trim() === "") {
    errors.push(`${fieldName} is required.`);
    return null;
  }

  const normalizedValue = value.trim();

  if (normalizedValue.length > maxLength) {
    errors.push(`${fieldName} must be ${maxLength} characters or fewer.`);
  }

  return normalizedValue;
}

function parseOptionalString(value, fieldName, errors, maxLength = 255) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    errors.push(`${fieldName} must be a string.`);
    return null;
  }

  const normalizedValue = value.trim();

  if (normalizedValue.length > maxLength) {
    errors.push(`${fieldName} must be ${maxLength} characters or fewer.`);
  }

  return normalizedValue || null;
}

function parseRequiredId(value, fieldName, errors) {
  const parsedValue = Number(value);

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    errors.push(`${fieldName} must be a valid positive integer.`);
    return null;
  }

  return parsedValue;
}

function parseOptionalId(value, fieldName, errors) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  return parseRequiredId(value, fieldName, errors);
}

function parseOptionalBoolean(value, fieldName, errors) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === "") {
    return null;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (value === 1 || value === "1" || value === "true") {
    return true;
  }

  if (value === 0 || value === "0" || value === "false") {
    return false;
  }

  errors.push(`${fieldName} must be true or false.`);
  return undefined;
}

function parseRequiredDate(value, fieldName, errors) {
  if (!value) {
    errors.push(`${fieldName} is required.`);
    return null;
  }

  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    errors.push(`${fieldName} must use YYYY-MM-DD format.`);
    return null;
  }

  return value;
}

function parseOptionalDate(value, fieldName, errors) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === "") {
    return null;
  }

  return parseRequiredDate(value, fieldName, errors);
}

function parseMoney(value, fieldName, errors, required = true) {
  if ((value === undefined || value === null || value === "") && !required) {
    return null;
  }

  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue) || parsedValue < 0) {
    errors.push(`${fieldName} must be a valid non-negative number.`);
    return null;
  }

  return parsedValue.toFixed(2);
}

function validateAttachmentMetadata(attachmentMetadata, errors) {
  if (attachmentMetadata === undefined) {
    return undefined;
  }

  if (!Array.isArray(attachmentMetadata)) {
    errors.push("Attachment metadata must be an array.");
    return undefined;
  }

  return attachmentMetadata.map((attachment, index) => {
    const fileErrors = [];

    if (!attachment || typeof attachment !== "object" || Array.isArray(attachment)) {
      errors.push(`Attachment ${index + 1} must be an object.`);
      return null;
    }

    const normalizedAttachment = {
      fileName: assertNonEmptyString(
        attachment.fileName,
        `Attachment ${index + 1} file name`,
        fileErrors,
        255
      ),
      originalFileName:
        parseOptionalString(
          attachment.originalFileName,
          `Attachment ${index + 1} original file name`,
          fileErrors,
          255
        ) || attachment.fileName?.trim() || null,
      mimeType: assertNonEmptyString(
        attachment.mimeType,
        `Attachment ${index + 1} mime type`,
        fileErrors,
        100
      ),
      fileSizeBytes: parseRequiredId(
        attachment.fileSizeBytes,
        `Attachment ${index + 1} file size`,
        fileErrors
      ),
      fileChecksumSha256: parseOptionalString(
        attachment.fileChecksumSha256,
        `Attachment ${index + 1} checksum`,
        fileErrors,
        64
      ),
      storageProvider:
        parseOptionalString(
          attachment.storageProvider,
          `Attachment ${index + 1} storage provider`,
          fileErrors,
          50
        ) || "local",
      storagePath: assertNonEmptyString(
        attachment.storagePath,
        `Attachment ${index + 1} storage path`,
        fileErrors,
        500
      ),
      isPrimaryDocument: parseOptionalBoolean(
        attachment.isPrimaryDocument,
        `Attachment ${index + 1} primary document flag`,
        fileErrors
      ),
      uploadedAt:
        parseOptionalString(
          attachment.uploadedAt,
          `Attachment ${index + 1} uploaded timestamp`,
          fileErrors,
          30
        ) || null
    };

    if (normalizedAttachment.isPrimaryDocument === undefined) {
      normalizedAttachment.isPrimaryDocument = true;
    }

    if (fileErrors.length > 0) {
      errors.push(...fileErrors);
      return null;
    }

    return normalizedAttachment;
  });
}

function validateInvoicePayload(payload, { partial = false } = {}) {
  const errors = [];
  const normalizedPayload = {};

  if (!partial || payload.supplierId !== undefined) {
    normalizedPayload.supplierId = partial
      ? parseOptionalId(payload.supplierId, "Supplier", errors)
      : parseRequiredId(payload.supplierId, "Supplier", errors);
  }

  if (!partial || payload.invoiceNumber !== undefined) {
    normalizedPayload.invoiceNumber = partial
      ? parseOptionalString(payload.invoiceNumber, "Invoice number", errors, 100)
      : assertNonEmptyString(payload.invoiceNumber, "Invoice number", errors, 100);
  }

  if (!partial || payload.invoiceDate !== undefined) {
    normalizedPayload.invoiceDate = partial
      ? parseOptionalDate(payload.invoiceDate, "Invoice date", errors)
      : parseRequiredDate(payload.invoiceDate, "Invoice date", errors);
  }

  if (!partial || payload.dueDate !== undefined) {
    normalizedPayload.dueDate = parseOptionalDate(payload.dueDate, "Due date", errors);
  }

  if (!partial || payload.subtotal !== undefined) {
    normalizedPayload.subtotal = parseMoney(payload.subtotal, "Subtotal", errors, !partial);
  }

  if (!partial || payload.tax !== undefined) {
    normalizedPayload.tax = parseMoney(payload.tax, "Tax", errors, !partial);
  }

  if (!partial || payload.total !== undefined) {
    normalizedPayload.total = parseMoney(payload.total, "Total", errors, !partial);
  }

  if (!partial || payload.currency !== undefined) {
    const currency = partial
      ? parseOptionalString(payload.currency, "Currency", errors, 3)
      : assertNonEmptyString(payload.currency, "Currency", errors, 3);

    if (currency && !CURRENCY_REGEX.test(currency.toUpperCase())) {
      errors.push("Currency must be a 3-letter ISO code.");
    }

    normalizedPayload.currency = currency ? currency.toUpperCase() : currency;
  }

  if (!partial || payload.externalPoNumber !== undefined) {
    normalizedPayload.externalPoNumber = parseOptionalString(
      payload.externalPoNumber,
      "External PO number",
      errors,
      100
    );
  }

  if (!partial || payload.externalPoVerified !== undefined) {
    normalizedPayload.externalPoVerified = parseOptionalBoolean(
      payload.externalPoVerified,
      "External PO verified",
      errors
    );
  }

  if (!partial || payload.verificationNotes !== undefined) {
    normalizedPayload.verificationNotes = parseOptionalString(
      payload.verificationNotes,
      "Verification notes",
      errors,
      5000
    );
  }

  if (!partial || payload.assignedUserId !== undefined) {
    normalizedPayload.assignedUserId = parseOptionalId(
      payload.assignedUserId,
      "Assigned user",
      errors
    );
  }

  if (!partial || payload.status !== undefined) {
    const status = partial
      ? parseOptionalString(payload.status, "Status", errors, 50)
      : assertNonEmptyString(payload.status, "Status", errors, 50);

    if (status && !INVOICE_STATUSES.includes(status)) {
      errors.push(`Status must be one of: ${INVOICE_STATUSES.join(", ")}.`);
    }

    if (status && PAYMENT_MANAGED_INVOICE_STATUSES.includes(status)) {
      errors.push("Paid invoices are set automatically by the payment workflow.");
    }

    normalizedPayload.status = status;
  }

  if (!partial || payload.duplicateFlag !== undefined) {
    normalizedPayload.duplicateFlag = parseOptionalBoolean(
      payload.duplicateFlag,
      "Duplicate flag",
      errors
    );
  }

  if (!partial || payload.holdReason !== undefined) {
    normalizedPayload.holdReason = parseOptionalString(
      payload.holdReason,
      "Hold reason",
      errors,
      255
    );
  }

  if (!partial || payload.attachmentMetadata !== undefined) {
    normalizedPayload.attachmentMetadata = validateAttachmentMetadata(
      payload.attachmentMetadata,
      errors
    );
  }

  if (
    normalizedPayload.invoiceDate &&
    normalizedPayload.dueDate &&
    normalizedPayload.dueDate < normalizedPayload.invoiceDate
  ) {
    errors.push("Due date cannot be earlier than invoice date.");
  }

  if (errors.length > 0) {
    throw new ApiError(400, "Invoice validation failed.", errors);
  }

  return normalizedPayload;
}

function validateCommentPayload(payload) {
  const errors = [];
  const commentText = assertNonEmptyString(payload.commentText, "Comment text", errors, 5000);
  const isInternal = parseOptionalBoolean(payload.isInternal, "Internal flag", errors);

  if (errors.length > 0) {
    throw new ApiError(400, "Comment validation failed.", errors);
  }

  return {
    commentText,
    isInternal: isInternal === undefined ? true : isInternal
  };
}

function parseInvoiceFilters(query) {
  const errors = [];
  const filters = {
    search: parseOptionalString(query.search, "Search", errors, 255),
    status: parseOptionalString(query.status, "Status", errors, 50),
    supplierId: parseOptionalId(query.supplierId, "Supplier", errors),
    assignedUserId: parseOptionalId(query.assignedUserId, "Assigned user", errors),
    duplicateFlag: parseOptionalBoolean(query.duplicateFlag, "Duplicate flag", errors),
    onHold: parseOptionalBoolean(query.onHold, "On hold flag", errors),
    currency: parseOptionalString(query.currency, "Currency", errors, 3)
  };

  if (filters.status && !INVOICE_STATUSES.includes(filters.status)) {
    errors.push(`Status must be one of: ${INVOICE_STATUSES.join(", ")}.`);
  }

  if (filters.currency && !CURRENCY_REGEX.test(filters.currency.toUpperCase())) {
    errors.push("Currency must be a 3-letter ISO code.");
  }

  if (filters.currency) {
    filters.currency = filters.currency.toUpperCase();
  }

  if (errors.length > 0) {
    throw new ApiError(400, "Invalid invoice filters.", errors);
  }

  return filters;
}

module.exports = {
  INVOICE_STATUSES,
  parseInvoiceFilters,
  validateCommentPayload,
  validateInvoicePayload
};
