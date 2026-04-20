import { apiRequest } from "./api";

export function createEmptyReportFilters() {
  return {
    search: "",
    supplierId: "",
    assignedUserId: "",
    status: "",
    currency: "",
    dateFrom: "",
    dateTo: "",
    overdueOnly: false,
    onHoldOnly: false
  };
}

function buildQueryString(filters = {}) {
  const searchParams = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (
      value !== "" &&
      value !== null &&
      value !== undefined &&
      !(typeof value === "boolean" && value === false)
    ) {
      searchParams.set(key, String(value));
    }
  });

  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : "";
}

export async function fetchReportMeta() {
  const response = await apiRequest("/reports/meta");
  return response.data;
}

export async function fetchDashboardReport(filters = {}) {
  const response = await apiRequest(`/reports/dashboard${buildQueryString(filters)}`);
  return response.data;
}

export async function fetchReportsOverview(filters = {}) {
  const response = await apiRequest(`/reports/overview${buildQueryString(filters)}`);
  return response.data;
}

export function formatCurrency(amount, currency = "USD") {
  if (amount === null || amount === undefined || Number.isNaN(Number(amount))) {
    return "Not set";
  }

  return new Intl.NumberFormat("en-NZ", {
    style: "currency",
    currency
  }).format(Number(amount));
}

export function formatCompactCurrency(amount, currency = "USD") {
  if (amount === null || amount === undefined || Number.isNaN(Number(amount))) {
    return "Not set";
  }

  return new Intl.NumberFormat("en-NZ", {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 1
  }).format(Number(amount));
}

export function formatDate(value) {
  if (!value) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en-NZ", { dateStyle: "medium" }).format(new Date(value));
}
