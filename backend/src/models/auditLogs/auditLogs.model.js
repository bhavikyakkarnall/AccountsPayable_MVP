const { pool } = require("../../config/database");

const AUDIT_EVENT_TYPES = Object.freeze({
  INVOICE_CREATED: "invoice_created",
  INVOICE_UPDATED: "invoice_updated",
  STATUS_CHANGED: "status_changed",
  ASSIGNMENT_CHANGED: "assignment_changed",
  VERIFICATION_CHANGED: "verification_changed",
  APPROVAL_ACTION: "approval_action",
  PAYMENT_UPDATED: "payment_updated",
  COMMENT_ADDED: "comment_added"
});

const AUDIT_TARGET_TYPES = Object.freeze({
  INVOICE: "invoice",
  PAYMENT: "payment",
  COMMENT: "comment",
  APPROVAL: "approval"
});

function tryParseJson(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch (error) {
    return value;
  }
}

function normalizeValue(value) {
  const parsedValue = tryParseJson(value);

  if (parsedValue === undefined) {
    return null;
  }

  if (parsedValue instanceof Date) {
    return parsedValue.toISOString();
  }

  if (Array.isArray(parsedValue)) {
    return parsedValue.map((item) => normalizeValue(item));
  }

  if (parsedValue && typeof parsedValue === "object") {
    return Object.keys(parsedValue)
      .sort()
      .reduce((result, key) => {
        result[key] = normalizeValue(parsedValue[key]);
        return result;
      }, {});
  }

  return parsedValue;
}

function valuesAreEqual(left, right) {
  return JSON.stringify(normalizeValue(left)) === JSON.stringify(normalizeValue(right));
}

function buildFieldChange(field, label, fromValue, toValue) {
  if (valuesAreEqual(fromValue, toValue)) {
    return null;
  }

  return {
    field,
    label,
    from: normalizeValue(fromValue),
    to: normalizeValue(toValue)
  };
}

async function createInvoiceAuditLog(
  executor,
  {
    invoiceId,
    actorUserId = null,
    eventType,
    actionLabel,
    targetType = AUDIT_TARGET_TYPES.INVOICE,
    targetId = null,
    changedFields = [],
    metadata = null
  }
) {
  await executor.query(
    `
      INSERT INTO invoice_audit_logs (
        invoice_id,
        actor_user_id,
        event_type,
        action_label,
        target_type,
        target_id,
        changed_fields_json,
        metadata_json
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      invoiceId,
      actorUserId,
      eventType,
      actionLabel,
      targetType,
      targetId,
      JSON.stringify(changedFields || []),
      metadata ? JSON.stringify(metadata) : null
    ]
  );
}

function mapAuditRow(row) {
  return {
    auditLogId: row.auditLogId,
    invoiceId: row.invoiceId,
    invoiceNumber: row.invoiceNumber,
    actorUserId: row.actorUserId,
    actorUserName: row.actorUserName?.trim() || null,
    eventType: row.eventType,
    actionLabel: row.actionLabel,
    targetType: row.targetType,
    targetId: row.targetId,
    changedFields: Array.isArray(tryParseJson(row.changedFields)) ? tryParseJson(row.changedFields) : [],
    metadata: tryParseJson(row.metadata),
    createdAt: row.createdAt
  };
}

async function listAuditEvents(filters = {}, executor = pool) {
  const clauses = [];
  const params = [];
  const limit = Number.isInteger(filters.limit) && filters.limit > 0
    ? Math.min(filters.limit, 250)
    : 100;

  if (filters.invoiceId) {
    clauses.push("l.invoice_id = ?");
    params.push(filters.invoiceId);
  }

  const whereClause = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const [rows] = await executor.query(
    `
      SELECT
        l.invoice_audit_log_id AS auditLogId,
        l.invoice_id AS invoiceId,
        i.invoice_number AS invoiceNumber,
        l.actor_user_id AS actorUserId,
        TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))) AS actorUserName,
        l.event_type AS eventType,
        l.action_label AS actionLabel,
        l.target_type AS targetType,
        l.target_id AS targetId,
        l.changed_fields_json AS changedFields,
        l.metadata_json AS metadata,
        l.created_at AS createdAt
      FROM invoice_audit_logs l
      INNER JOIN invoices i ON i.invoice_id = l.invoice_id
      LEFT JOIN users u ON u.user_id = l.actor_user_id
      ${whereClause}
      ORDER BY l.created_at DESC, l.invoice_audit_log_id DESC
      LIMIT ${limit}
    `,
    params
  );

  return rows.map(mapAuditRow);
}

async function listInvoiceAuditLogs(invoiceId, executor = pool) {
  return listAuditEvents({ invoiceId, limit: 250 }, executor);
}

module.exports = {
  AUDIT_EVENT_TYPES,
  AUDIT_TARGET_TYPES,
  buildFieldChange,
  createInvoiceAuditLog,
  listAuditEvents,
  listInvoiceAuditLogs,
  normalizeValue,
  valuesAreEqual
};
