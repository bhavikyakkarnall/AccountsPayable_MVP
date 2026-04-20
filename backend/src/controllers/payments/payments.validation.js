const ApiError = require("../../utils/ApiError");
const { PAYMENT_STATUSES } = require("../../models/payments/payments.model");

const CURRENCY_REGEX = /^[A-Z]{3}$/;

function parseOptionalString(value, fieldName, errors, maxLength = 255) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    errors.push(`${fieldName} must be a string.`);
    return undefined;
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
    return undefined;
  }

  return parseRequiredId(value, fieldName, errors);
}

function parseOptionalDate(value, fieldName, errors) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === "") {
    return null;
  }

  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    errors.push(`${fieldName} must use YYYY-MM-DD format.`);
    return undefined;
  }

  return value;
}

function parseOptionalMoney(value, fieldName, errors) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue) || parsedValue < 0) {
    errors.push(`${fieldName} must be a valid non-negative number.`);
    return undefined;
  }

  return parsedValue.toFixed(2);
}

function validatePaymentPayload(payload, { partial = false } = {}) {
  const errors = [];
  const normalizedPayload = {};

  if (!partial || payload.invoiceId !== undefined) {
    normalizedPayload.invoiceId = partial
      ? parseOptionalId(payload.invoiceId, "Invoice", errors)
      : parseRequiredId(payload.invoiceId, "Invoice", errors);
  }

  if (!partial || payload.paymentStatus !== undefined) {
    const paymentStatus = parseOptionalString(payload.paymentStatus, "Payment status", errors, 50);

    if (paymentStatus && !PAYMENT_STATUSES.includes(paymentStatus)) {
      errors.push(`Payment status must be one of: ${PAYMENT_STATUSES.join(", ")}.`);
    }

    normalizedPayload.paymentStatus = paymentStatus;
  }

  if (!partial || payload.paymentReference !== undefined) {
    normalizedPayload.paymentReference = parseOptionalString(
      payload.paymentReference,
      "Payment reference",
      errors,
      100
    );
  }

  if (!partial || payload.paymentDate !== undefined) {
    normalizedPayload.paymentDate = parseOptionalDate(payload.paymentDate, "Payment date", errors);
  }

  if (!partial || payload.notes !== undefined) {
    normalizedPayload.notes = parseOptionalString(payload.notes, "Notes", errors, 5000);
  }

  if (!partial || payload.paymentMethod !== undefined) {
    normalizedPayload.paymentMethod = parseOptionalString(
      payload.paymentMethod,
      "Payment method",
      errors,
      50
    );
  }

  if (!partial || payload.amount !== undefined) {
    normalizedPayload.amount = parseOptionalMoney(payload.amount, "Amount", errors);
  }

  if (!partial || payload.currency !== undefined) {
    const currency = parseOptionalString(payload.currency, "Currency", errors, 3);

    if (currency && !CURRENCY_REGEX.test(currency.toUpperCase())) {
      errors.push("Currency must be a 3-letter ISO code.");
    }

    normalizedPayload.currency = currency ? currency.toUpperCase() : currency;
  }

  if (errors.length > 0) {
    throw new ApiError(400, "Payment validation failed.", errors);
  }

  return normalizedPayload;
}

function parsePaymentFilters(query) {
  const errors = [];
  const filters = {
    invoiceId: parseOptionalId(query.invoiceId, "Invoice", errors),
    paymentStatus: parseOptionalString(query.paymentStatus, "Payment status", errors, 50)
  };

  if (filters.paymentStatus && !PAYMENT_STATUSES.includes(filters.paymentStatus)) {
    errors.push(`Payment status must be one of: ${PAYMENT_STATUSES.join(", ")}.`);
  }

  if (errors.length > 0) {
    throw new ApiError(400, "Invalid payment filters.", errors);
  }

  return filters;
}

module.exports = {
  parsePaymentFilters,
  validatePaymentPayload
};
