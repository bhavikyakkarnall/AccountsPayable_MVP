const { pool } = require("../../config/database");

const NEEDS_REVIEW_CONDITION =
  "i.status IN ('new', 'needs_review', 'in_review', 'sent_back') AND TRIM(COALESCE(i.hold_reason, '')) = ''";
const PENDING_APPROVAL_CONDITION = "i.status = 'pending_approval'";
const APPROVED_UNPAID_CONDITION =
  "i.status = 'approved' AND COALESCE(i.payment_status, 'unpaid') <> 'paid'";
const OVERDUE_CONDITION =
  "i.due_date IS NOT NULL AND i.due_date < CURRENT_DATE() AND COALESCE(i.payment_status, 'unpaid') <> 'paid' AND i.status NOT IN ('paid', 'rejected', 'duplicate')";
const ON_HOLD_CONDITION = "i.status = 'on_hold' OR TRIM(COALESCE(i.hold_reason, '')) <> ''";

function toNumber(value) {
  return value === null || value === undefined ? 0 : Number(value);
}

function mapQueueRow(row) {
  return {
    invoiceId: row.invoiceId,
    supplierId: row.supplierId,
    supplierName: row.supplierName,
    invoiceNumber: row.invoiceNumber,
    invoiceDate: row.invoiceDate,
    dueDate: row.dueDate,
    total: row.total === null ? null : Number(row.total),
    currency: row.currency,
    status: row.status,
    paymentStatus: row.paymentStatus || "unpaid",
    assignedUserName: row.assignedUserName?.trim() || null,
    holdReason: row.holdReason,
    daysOverdue: row.daysOverdue === null ? null : Number(row.daysOverdue)
  };
}

function buildReportWhereClause(filters = {}) {
  const clauses = [];
  const params = [];

  if (filters.search) {
    clauses.push("(i.invoice_number LIKE ? OR s.supplier_name LIKE ?)");
    params.push(`%${filters.search}%`, `%${filters.search}%`);
  }

  if (filters.status) {
    clauses.push("i.status = ?");
    params.push(filters.status);
  }

  if (filters.supplierId) {
    clauses.push("i.supplier_id = ?");
    params.push(filters.supplierId);
  }

  if (filters.assignedUserId) {
    clauses.push("i.assigned_to = ?");
    params.push(filters.assignedUserId);
  }

  if (filters.currency) {
    clauses.push("i.currency = ?");
    params.push(filters.currency);
  }

  if (filters.dateFrom) {
    clauses.push("COALESCE(i.invoice_date, DATE(i.created_at)) >= ?");
    params.push(filters.dateFrom);
  }

  if (filters.dateTo) {
    clauses.push("COALESCE(i.invoice_date, DATE(i.created_at)) <= ?");
    params.push(filters.dateTo);
  }

  if (filters.overdueOnly === true) {
    clauses.push(`(${OVERDUE_CONDITION})`);
  }

  if (filters.onHoldOnly === true) {
    clauses.push(`(${ON_HOLD_CONDITION})`);
  }

  return {
    whereClause: clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "",
    params
  };
}

async function getReportMeta() {
  const [[supplierRows], [userRows], [currencyRows]] = await Promise.all([
    pool.query(
      `
        SELECT
          supplier_id AS supplierId,
          supplier_name AS supplierName
        FROM suppliers
        WHERE is_active = 1
        ORDER BY supplier_name ASC
      `
    ),
    pool.query(
      `
        SELECT
          user_id AS userId,
          email,
          TRIM(CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, ''))) AS fullName
        FROM users
        WHERE is_active = 1
        ORDER BY first_name ASC, last_name ASC, email ASC
      `
    ),
    pool.query(
      `
        SELECT DISTINCT currency
        FROM invoices
        WHERE currency IS NOT NULL
          AND currency <> ''
        ORDER BY currency ASC
      `
    )
  ]);

  return {
    suppliers: supplierRows,
    users: userRows.map((row) => ({
      userId: row.userId,
      email: row.email,
      fullName: row.fullName?.trim() || row.email
    })),
    currencies: currencyRows.map((row) => row.currency)
  };
}

async function getSummary(filters = {}) {
  const { whereClause, params } = buildReportWhereClause(filters);
  const [rows] = await pool.query(
    `
      SELECT
        COUNT(*) AS totalInvoices,
        SUM(COALESCE(i.total_amount, 0)) AS totalAmount,
        SUM(CASE WHEN ${NEEDS_REVIEW_CONDITION} THEN 1 ELSE 0 END) AS needingReviewCount,
        SUM(CASE WHEN ${NEEDS_REVIEW_CONDITION} THEN COALESCE(i.total_amount, 0) ELSE 0 END) AS needingReviewAmount,
        SUM(CASE WHEN ${PENDING_APPROVAL_CONDITION} THEN 1 ELSE 0 END) AS pendingApprovalCount,
        SUM(CASE WHEN ${PENDING_APPROVAL_CONDITION} THEN COALESCE(i.total_amount, 0) ELSE 0 END) AS pendingApprovalAmount,
        SUM(CASE WHEN ${APPROVED_UNPAID_CONDITION} THEN 1 ELSE 0 END) AS approvedUnpaidCount,
        SUM(CASE WHEN ${APPROVED_UNPAID_CONDITION} THEN COALESCE(i.total_amount, 0) ELSE 0 END) AS approvedUnpaidAmount,
        SUM(CASE WHEN ${OVERDUE_CONDITION} THEN 1 ELSE 0 END) AS overdueCount,
        SUM(CASE WHEN ${OVERDUE_CONDITION} THEN COALESCE(i.total_amount, 0) ELSE 0 END) AS overdueAmount,
        SUM(CASE WHEN ${ON_HOLD_CONDITION} THEN 1 ELSE 0 END) AS onHoldCount,
        SUM(CASE WHEN ${ON_HOLD_CONDITION} THEN COALESCE(i.total_amount, 0) ELSE 0 END) AS onHoldAmount
      FROM invoices i
      INNER JOIN suppliers s ON s.supplier_id = i.supplier_id
      ${whereClause}
    `,
    params
  );

  const row = rows[0] || {};

  return {
    totalInvoices: Number(row.totalInvoices || 0),
    totalAmount: toNumber(row.totalAmount),
    needingReview: {
      count: Number(row.needingReviewCount || 0),
      totalAmount: toNumber(row.needingReviewAmount)
    },
    pendingApproval: {
      count: Number(row.pendingApprovalCount || 0),
      totalAmount: toNumber(row.pendingApprovalAmount)
    },
    approvedUnpaid: {
      count: Number(row.approvedUnpaidCount || 0),
      totalAmount: toNumber(row.approvedUnpaidAmount)
    },
    overdue: {
      count: Number(row.overdueCount || 0),
      totalAmount: toNumber(row.overdueAmount)
    },
    onHold: {
      count: Number(row.onHoldCount || 0),
      totalAmount: toNumber(row.onHoldAmount)
    }
  };
}

async function getMonthlyTotals(filters = {}, { limit = 6 } = {}) {
  const { whereClause, params } = buildReportWhereClause(filters);
  const [rows] = await pool.query(
    `
      SELECT
        DATE_FORMAT(COALESCE(i.invoice_date, DATE(i.created_at)), '%Y-%m-01') AS monthStart,
        DATE_FORMAT(COALESCE(i.invoice_date, DATE(i.created_at)), '%b %Y') AS monthLabel,
        COUNT(*) AS invoiceCount,
        SUM(COALESCE(i.total_amount, 0)) AS totalAmount
      FROM invoices i
      INNER JOIN suppliers s ON s.supplier_id = i.supplier_id
      ${whereClause}
      GROUP BY DATE_FORMAT(COALESCE(i.invoice_date, DATE(i.created_at)), '%Y-%m-01'),
               DATE_FORMAT(COALESCE(i.invoice_date, DATE(i.created_at)), '%b %Y')
      ORDER BY monthStart DESC
      LIMIT ${Number(limit)}
    `,
    params
  );

  return rows
    .map((row) => ({
      monthStart: row.monthStart,
      monthLabel: row.monthLabel,
      invoiceCount: Number(row.invoiceCount || 0),
      totalAmount: toNumber(row.totalAmount)
    }))
    .reverse();
}

async function getSupplierSpendSummary(filters = {}, { limit = 8 } = {}) {
  const { whereClause, params } = buildReportWhereClause(filters);
  const [rows] = await pool.query(
    `
      SELECT
        i.supplier_id AS supplierId,
        s.supplier_name AS supplierName,
        COUNT(*) AS invoiceCount,
        SUM(COALESCE(i.total_amount, 0)) AS totalAmount,
        SUM(CASE WHEN ${OVERDUE_CONDITION} THEN 1 ELSE 0 END) AS overdueCount,
        SUM(CASE WHEN ${APPROVED_UNPAID_CONDITION} THEN COALESCE(i.total_amount, 0) ELSE 0 END) AS approvedUnpaidAmount
      FROM invoices i
      INNER JOIN suppliers s ON s.supplier_id = i.supplier_id
      ${whereClause}
      GROUP BY i.supplier_id, s.supplier_name
      ORDER BY totalAmount DESC, s.supplier_name ASC
      LIMIT ${Number(limit)}
    `,
    params
  );

  return rows.map((row) => ({
    supplierId: row.supplierId,
    supplierName: row.supplierName,
    invoiceCount: Number(row.invoiceCount || 0),
    totalAmount: toNumber(row.totalAmount),
    overdueCount: Number(row.overdueCount || 0),
    approvedUnpaidAmount: toNumber(row.approvedUnpaidAmount)
  }));
}

async function getStatusBreakdown(filters = {}) {
  const { whereClause, params } = buildReportWhereClause(filters);
  const [rows] = await pool.query(
    `
      SELECT
        i.status,
        COUNT(*) AS invoiceCount,
        SUM(COALESCE(i.total_amount, 0)) AS totalAmount
      FROM invoices i
      INNER JOIN suppliers s ON s.supplier_id = i.supplier_id
      ${whereClause}
      GROUP BY i.status
      ORDER BY invoiceCount DESC, totalAmount DESC, i.status ASC
    `,
    params
  );

  return rows.map((row) => ({
    status: row.status,
    invoiceCount: Number(row.invoiceCount || 0),
    totalAmount: toNumber(row.totalAmount)
  }));
}

async function getQueueTable(filters = {}, condition, { limit = 6 } = {}) {
  const { whereClause, params } = buildReportWhereClause(filters);
  const conditionClause = condition ? `(${condition})` : "1 = 1";
  const effectiveWhereClause = whereClause
    ? `${whereClause} AND ${conditionClause}`
    : `WHERE ${conditionClause}`;

  const [rows] = await pool.query(
    `
      SELECT
        i.invoice_id AS invoiceId,
        i.supplier_id AS supplierId,
        s.supplier_name AS supplierName,
        i.invoice_number AS invoiceNumber,
        DATE_FORMAT(i.invoice_date, '%Y-%m-%d') AS invoiceDate,
        DATE_FORMAT(i.due_date, '%Y-%m-%d') AS dueDate,
        i.total_amount AS total,
        i.currency,
        i.status,
        i.payment_status AS paymentStatus,
        i.hold_reason AS holdReason,
        TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))) AS assignedUserName,
        CASE
          WHEN i.due_date IS NOT NULL AND i.due_date < CURRENT_DATE()
          THEN DATEDIFF(CURRENT_DATE(), i.due_date)
          ELSE NULL
        END AS daysOverdue
      FROM invoices i
      INNER JOIN suppliers s ON s.supplier_id = i.supplier_id
      LEFT JOIN users u ON u.user_id = i.assigned_to
      ${effectiveWhereClause}
      ORDER BY
        CASE WHEN i.due_date IS NULL THEN 1 ELSE 0 END ASC,
        i.due_date ASC,
        i.updated_at DESC,
        i.invoice_id DESC
      LIMIT ${Number(limit)}
    `,
    params
  );

  return rows.map(mapQueueRow);
}

async function getDashboardReport(filters = {}) {
  const [summary, monthlyTotals, supplierSpendSummary, needingReview, pendingApproval, approvedUnpaid, overdue, onHold] =
    await Promise.all([
      getSummary(filters),
      getMonthlyTotals(filters, { limit: 6 }),
      getSupplierSpendSummary(filters, { limit: 6 }),
      getQueueTable(filters, NEEDS_REVIEW_CONDITION, { limit: 5 }),
      getQueueTable(filters, PENDING_APPROVAL_CONDITION, { limit: 5 }),
      getQueueTable(filters, APPROVED_UNPAID_CONDITION, { limit: 5 }),
      getQueueTable(filters, OVERDUE_CONDITION, { limit: 5 }),
      getQueueTable(filters, ON_HOLD_CONDITION, { limit: 5 })
    ]);

  return {
    summary,
    monthlyTotals,
    supplierSpendSummary,
    queues: {
      needingReview,
      pendingApproval,
      approvedUnpaid,
      overdue,
      onHold
    }
  };
}

async function getOverviewReport(filters = {}) {
  const [summary, monthlyTotals, supplierSpendSummary, statusBreakdown, overdueInvoices, approvedUnpaidInvoices] =
    await Promise.all([
      getSummary(filters),
      getMonthlyTotals(filters, { limit: 12 }),
      getSupplierSpendSummary(filters, { limit: 12 }),
      getStatusBreakdown(filters),
      getQueueTable(filters, OVERDUE_CONDITION, { limit: 10 }),
      getQueueTable(filters, APPROVED_UNPAID_CONDITION, { limit: 10 })
    ]);

  return {
    summary,
    monthlyTotals,
    supplierSpendSummary,
    statusBreakdown,
    queues: {
      overdue: overdueInvoices,
      approvedUnpaid: approvedUnpaidInvoices
    }
  };
}

module.exports = {
  getDashboardReport,
  getOverviewReport,
  getReportMeta
};
