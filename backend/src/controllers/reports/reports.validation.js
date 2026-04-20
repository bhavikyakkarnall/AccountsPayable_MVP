function parsePositiveInteger(value) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const parsedValue = Number(value);

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    return undefined;
  }

  return parsedValue;
}

function parseDate(value) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
    return undefined;
  }

  return value;
}

function parseBoolean(value) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (typeof value === "boolean") {
    return value;
  }

  const normalizedValue = String(value).toLowerCase();

  if (["true", "1", "yes"].includes(normalizedValue)) {
    return true;
  }

  if (["false", "0", "no"].includes(normalizedValue)) {
    return false;
  }

  return undefined;
}

function parseReportFilters(query = {}) {
  const search = typeof query.search === "string" ? query.search.trim() : "";
  const status = typeof query.status === "string" ? query.status.trim() : "";
  const currency = typeof query.currency === "string" ? query.currency.trim().toUpperCase() : "";

  return {
    search: search || undefined,
    status: status || undefined,
    supplierId: parsePositiveInteger(query.supplierId),
    assignedUserId: parsePositiveInteger(query.assignedUserId),
    currency: currency || undefined,
    dateFrom: parseDate(query.dateFrom),
    dateTo: parseDate(query.dateTo),
    overdueOnly: parseBoolean(query.overdueOnly),
    onHoldOnly: parseBoolean(query.onHoldOnly)
  };
}

module.exports = {
  parseReportFilters
};
