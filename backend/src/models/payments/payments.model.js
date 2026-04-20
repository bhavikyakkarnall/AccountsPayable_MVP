const ApiError = require("../../utils/ApiError");
const { pool } = require("../../config/database");
const auditLogsModel = require("../auditLogs/auditLogs.model");

const PAYMENT_STATUSES = Object.freeze([
  "ready_for_payment",
  "payment_submitted",
  "paid",
  "payment_failed"
]);

const PAYMENT_STATUS_TRANSITIONS = Object.freeze({
  ready_for_payment: ["payment_submitted", "payment_failed", "paid"],
  payment_submitted: ["paid", "payment_failed"],
  payment_failed: ["ready_for_payment"],
  paid: []
});

function normalizeAmount(value) {
  return value === null || value === undefined ? null : Number(value);
}

function mapPaymentRow(row) {
  if (!row) {
    return null;
  }

  return {
    paymentId: row.paymentId,
    invoiceId: row.invoiceId,
    invoiceNumber: row.invoiceNumber,
    supplierId: row.supplierId,
    supplierName: row.supplierName,
    amount: normalizeAmount(row.amount),
    currency: row.currency,
    paymentStatus: row.paymentStatus,
    paymentReference: row.paymentReference,
    paymentDate: row.paymentDate,
    paymentMethod: row.paymentMethod,
    notes: row.notes,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    createdByUserId: row.createdByUserId,
    createdByUserName: row.createdByUserName,
    updatedByUserId: row.updatedByUserId,
    updatedByUserName: row.updatedByUserName
  };
}

async function findInvoiceForPayment(connection, invoiceId, { forUpdate = false } = {}) {
  const [rows] = await connection.query(
    `
      SELECT
        i.invoice_id AS invoiceId,
        i.supplier_id AS supplierId,
        s.supplier_name AS supplierName,
        i.invoice_number AS invoiceNumber,
        i.total_amount AS totalAmount,
        i.currency,
        i.status,
        i.payment_status AS paymentStatus
      FROM invoices i
      INNER JOIN suppliers s ON s.supplier_id = i.supplier_id
      WHERE i.invoice_id = ?
      ${forUpdate ? "FOR UPDATE" : ""}
      LIMIT 1
    `,
    [invoiceId]
  );

  return rows[0] || null;
}

function assertPaymentTransition(fromStatus, toStatus) {
  if (fromStatus === toStatus) {
    return;
  }

  const allowedStatuses = PAYMENT_STATUS_TRANSITIONS[fromStatus] || [];

  if (!allowedStatuses.includes(toStatus)) {
    throw new ApiError(
      400,
      `Payment status cannot transition from ${fromStatus} to ${toStatus}.`
    );
  }
}

function assertPaymentBusinessRules(payment) {
  if (
    (payment.paymentStatus === "payment_submitted" || payment.paymentStatus === "paid") &&
    !payment.paymentReference
  ) {
    throw new ApiError(
      400,
      "Payment reference is required when a payment is submitted or marked as paid."
    );
  }

  if (payment.paymentStatus === "paid" && !payment.paymentDate) {
    throw new ApiError(400, "Payment date is required when a payment is marked as paid.");
  }
}

async function insertInvoiceStatusHistory(connection, invoiceId, fromStatus, toStatus, actorUserId) {
  await connection.query(
    `
      INSERT INTO invoice_status_history (
        invoice_id,
        from_status,
        to_status,
        change_reason,
        changed_by_user_id
      )
      VALUES (?, ?, ?, ?, ?)
    `,
    [invoiceId, fromStatus, toStatus, "Updated from payment workflow", actorUserId]
  );
}

async function synchronizeInvoicePaymentState(connection, invoiceId, actorUserId) {
  const [latestPaymentRows] = await connection.query(
    `
      SELECT
        payment_status AS paymentStatus
      FROM payments
      WHERE invoice_id = ?
      ORDER BY updated_at DESC, payment_id DESC
      LIMIT 1
    `,
    [invoiceId]
  );

  const latestPaymentStatus = latestPaymentRows[0]?.paymentStatus || "unpaid";
  const [invoiceRows] = await connection.query(
    `
      SELECT
        status,
        payment_status AS paymentStatus
      FROM invoices
      WHERE invoice_id = ?
      LIMIT 1
    `,
    [invoiceId]
  );

  const invoice = invoiceRows[0];

  if (!invoice) {
    return;
  }

  let nextInvoiceStatus = invoice.status;

  if (latestPaymentStatus === "paid") {
    nextInvoiceStatus = "paid";
  } else if (invoice.status === "paid") {
    nextInvoiceStatus = "approved";
  }

  await connection.query(
    `
      UPDATE invoices
      SET
        payment_status = ?,
        status = ?,
        updated_by_user_id = ?
      WHERE invoice_id = ?
    `,
    [latestPaymentStatus, nextInvoiceStatus, actorUserId, invoiceId]
  );

  if (invoice.paymentStatus !== latestPaymentStatus) {
    await auditLogsModel.createInvoiceAuditLog(connection, {
      invoiceId,
      actorUserId,
      eventType: auditLogsModel.AUDIT_EVENT_TYPES.PAYMENT_UPDATED,
      actionLabel: "Updated invoice payment status",
      changedFields: [
        auditLogsModel.buildFieldChange(
          "paymentStatus",
          "Payment status",
          invoice.paymentStatus,
          latestPaymentStatus
        )
      ].filter(Boolean)
    });
  }

  if (invoice.status !== nextInvoiceStatus) {
    await insertInvoiceStatusHistory(
      connection,
      invoiceId,
      invoice.status,
      nextInvoiceStatus,
      actorUserId
    );

    await auditLogsModel.createInvoiceAuditLog(connection, {
      invoiceId,
      actorUserId,
      eventType: auditLogsModel.AUDIT_EVENT_TYPES.STATUS_CHANGED,
      actionLabel: "Changed invoice status",
      changedFields: [
        auditLogsModel.buildFieldChange("status", "Status", invoice.status, nextInvoiceStatus)
      ].filter(Boolean),
      metadata: {
        reason: "Updated from payment workflow"
      }
    });
  }
}

async function listPayments(filters = {}) {
  const clauses = [];
  const params = [];

  if (filters.invoiceId) {
    clauses.push("p.invoice_id = ?");
    params.push(filters.invoiceId);
  }

  if (filters.paymentId) {
    clauses.push("p.payment_id = ?");
    params.push(filters.paymentId);
  }

  if (filters.paymentStatus) {
    clauses.push("p.payment_status = ?");
    params.push(filters.paymentStatus);
  }

  const whereClause = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";

  const [rows] = await pool.query(
    `
      SELECT
        p.payment_id AS paymentId,
        p.invoice_id AS invoiceId,
        i.invoice_number AS invoiceNumber,
        i.supplier_id AS supplierId,
        s.supplier_name AS supplierName,
        p.amount,
        p.currency,
        p.payment_status AS paymentStatus,
        p.payment_reference AS paymentReference,
        DATE_FORMAT(p.payment_date, '%Y-%m-%d') AS paymentDate,
        p.payment_method AS paymentMethod,
        p.notes,
        p.created_at AS createdAt,
        p.updated_at AS updatedAt,
        p.created_by_user_id AS createdByUserId,
        TRIM(CONCAT(COALESCE(cu.first_name, ''), ' ', COALESCE(cu.last_name, ''))) AS createdByUserName,
        p.updated_by_user_id AS updatedByUserId,
        TRIM(CONCAT(COALESCE(uu.first_name, ''), ' ', COALESCE(uu.last_name, ''))) AS updatedByUserName
      FROM payments p
      INNER JOIN invoices i ON i.invoice_id = p.invoice_id
      INNER JOIN suppliers s ON s.supplier_id = i.supplier_id
      LEFT JOIN users cu ON cu.user_id = p.created_by_user_id
      LEFT JOIN users uu ON uu.user_id = p.updated_by_user_id
      ${whereClause}
      ORDER BY p.updated_at DESC, p.payment_id DESC
    `,
    params
  );

  return rows.map(mapPaymentRow);
}

async function getPaymentById(paymentId) {
  const [rows] = await pool.query(
    `
      SELECT
        p.payment_id AS paymentId,
        p.invoice_id AS invoiceId,
        i.invoice_number AS invoiceNumber,
        i.supplier_id AS supplierId,
        s.supplier_name AS supplierName,
        p.amount,
        p.currency,
        p.payment_status AS paymentStatus,
        p.payment_reference AS paymentReference,
        DATE_FORMAT(p.payment_date, '%Y-%m-%d') AS paymentDate,
        p.payment_method AS paymentMethod,
        p.notes,
        p.created_at AS createdAt,
        p.updated_at AS updatedAt,
        p.created_by_user_id AS createdByUserId,
        TRIM(CONCAT(COALESCE(cu.first_name, ''), ' ', COALESCE(cu.last_name, ''))) AS createdByUserName,
        p.updated_by_user_id AS updatedByUserId,
        TRIM(CONCAT(COALESCE(uu.first_name, ''), ' ', COALESCE(uu.last_name, ''))) AS updatedByUserName
      FROM payments p
      INNER JOIN invoices i ON i.invoice_id = p.invoice_id
      INNER JOIN suppliers s ON s.supplier_id = i.supplier_id
      LEFT JOIN users cu ON cu.user_id = p.created_by_user_id
      LEFT JOIN users uu ON uu.user_id = p.updated_by_user_id
      WHERE p.payment_id = ?
      LIMIT 1
    `,
    [paymentId]
  );

  return mapPaymentRow(rows[0] || null);
}

async function listPayableInvoices() {
  const [rows] = await pool.query(
    `
      SELECT
        i.invoice_id AS invoiceId,
        i.invoice_number AS invoiceNumber,
        s.supplier_name AS supplierName,
        i.total_amount AS totalAmount,
        i.currency,
        i.payment_status AS paymentStatus,
        DATE_FORMAT(i.due_date, '%Y-%m-%d') AS dueDate
      FROM invoices i
      INNER JOIN suppliers s ON s.supplier_id = i.supplier_id
      WHERE i.status = 'approved'
        AND (i.payment_status IS NULL OR i.payment_status <> 'paid')
      ORDER BY i.due_date ASC, i.invoice_id DESC
    `
  );

  return rows.map((row) => ({
    invoiceId: row.invoiceId,
    invoiceNumber: row.invoiceNumber,
    supplierName: row.supplierName,
    totalAmount: normalizeAmount(row.totalAmount),
    currency: row.currency,
    paymentStatus: row.paymentStatus || "unpaid",
    dueDate: row.dueDate
  }));
}

async function createPayment(payload, actorUserId) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const invoice = await findInvoiceForPayment(connection, payload.invoiceId, { forUpdate: true });

    if (!invoice) {
      throw new ApiError(404, "Invoice not found.");
    }

    if (invoice.status !== "approved") {
      throw new ApiError(400, "Payments can only be created for approved invoices.");
    }

    const nextPayment = {
      invoiceId: invoice.invoiceId,
      amount: payload.amount ?? invoice.totalAmount,
      currency: payload.currency ?? invoice.currency,
      paymentStatus: payload.paymentStatus,
      paymentReference: payload.paymentReference,
      paymentDate: payload.paymentDate,
      paymentMethod: payload.paymentMethod,
      notes: payload.notes
    };

    if (nextPayment.amount === null || nextPayment.amount === undefined) {
      throw new ApiError(400, "Invoice total is required before creating a payment.");
    }

    assertPaymentBusinessRules(nextPayment);

    const [result] = await connection.query(
      `
        INSERT INTO payments (
          invoice_id,
          payment_reference,
          payment_date,
          amount,
          currency,
          payment_method,
          payment_status,
          notes,
          created_by_user_id,
          updated_by_user_id
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        nextPayment.invoiceId,
        nextPayment.paymentReference,
        nextPayment.paymentDate,
        nextPayment.amount,
        nextPayment.currency,
        nextPayment.paymentMethod,
        nextPayment.paymentStatus,
        nextPayment.notes,
        actorUserId,
        actorUserId
      ]
    );

    await auditLogsModel.createInvoiceAuditLog(connection, {
      invoiceId: invoice.invoiceId,
      actorUserId,
      eventType: auditLogsModel.AUDIT_EVENT_TYPES.PAYMENT_UPDATED,
      actionLabel: "Created payment",
      targetType: auditLogsModel.AUDIT_TARGET_TYPES.PAYMENT,
      targetId: result.insertId,
      changedFields: [
        {
          field: "amount",
          label: "Amount",
          from: null,
          to: nextPayment.amount
        },
        {
          field: "currency",
          label: "Currency",
          from: null,
          to: nextPayment.currency
        },
        {
          field: "paymentStatus",
          label: "Payment status",
          from: null,
          to: nextPayment.paymentStatus
        },
        {
          field: "paymentReference",
          label: "Payment reference",
          from: null,
          to: nextPayment.paymentReference
        },
        {
          field: "paymentDate",
          label: "Payment date",
          from: null,
          to: nextPayment.paymentDate
        },
        {
          field: "paymentMethod",
          label: "Payment method",
          from: null,
          to: nextPayment.paymentMethod
        }
      ].filter((change) => change.to !== undefined),
      metadata: {
        notes: nextPayment.notes || null
      }
    });

    await synchronizeInvoicePaymentState(connection, invoice.invoiceId, actorUserId);

    await connection.commit();
    return getPaymentById(result.insertId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function updatePayment(paymentId, payload, actorUserId) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [paymentRows] = await connection.query(
      `
        SELECT
          payment_id AS paymentId,
          invoice_id AS invoiceId,
          amount,
          currency,
          payment_status AS paymentStatus,
          payment_reference AS paymentReference,
          DATE_FORMAT(payment_date, '%Y-%m-%d') AS paymentDate,
          payment_method AS paymentMethod,
          notes
        FROM payments
        WHERE payment_id = ?
        FOR UPDATE
      `,
      [paymentId]
    );

    const existingPayment = paymentRows[0];

    if (!existingPayment) {
      throw new ApiError(404, "Payment not found.");
    }

    const invoice = await findInvoiceForPayment(connection, existingPayment.invoiceId, { forUpdate: true });

    if (!invoice) {
      throw new ApiError(404, "Invoice not found.");
    }

    const nextPayment = {
      amount: payload.amount === undefined ? existingPayment.amount : payload.amount,
      currency: payload.currency === undefined ? existingPayment.currency : payload.currency,
      paymentStatus:
        payload.paymentStatus === undefined ? existingPayment.paymentStatus : payload.paymentStatus,
      paymentReference:
        payload.paymentReference === undefined
          ? existingPayment.paymentReference
          : payload.paymentReference,
      paymentDate:
        payload.paymentDate === undefined ? existingPayment.paymentDate : payload.paymentDate,
      paymentMethod:
        payload.paymentMethod === undefined ? existingPayment.paymentMethod : payload.paymentMethod,
      notes: payload.notes === undefined ? existingPayment.notes : payload.notes
    };

    assertPaymentTransition(existingPayment.paymentStatus, nextPayment.paymentStatus);
    assertPaymentBusinessRules(nextPayment);

    const paymentFieldChanges = [
      auditLogsModel.buildFieldChange("amount", "Amount", existingPayment.amount, nextPayment.amount),
      auditLogsModel.buildFieldChange("currency", "Currency", existingPayment.currency, nextPayment.currency),
      auditLogsModel.buildFieldChange(
        "paymentStatus",
        "Payment status",
        existingPayment.paymentStatus,
        nextPayment.paymentStatus
      ),
      auditLogsModel.buildFieldChange(
        "paymentReference",
        "Payment reference",
        existingPayment.paymentReference,
        nextPayment.paymentReference
      ),
      auditLogsModel.buildFieldChange(
        "paymentDate",
        "Payment date",
        existingPayment.paymentDate,
        nextPayment.paymentDate
      ),
      auditLogsModel.buildFieldChange(
        "paymentMethod",
        "Payment method",
        existingPayment.paymentMethod,
        nextPayment.paymentMethod
      ),
      auditLogsModel.buildFieldChange("notes", "Notes", existingPayment.notes, nextPayment.notes)
    ].filter(Boolean);

    await connection.query(
      `
        UPDATE payments
        SET
          amount = ?,
          currency = ?,
          payment_status = ?,
          payment_reference = ?,
          payment_date = ?,
          payment_method = ?,
          notes = ?,
          updated_by_user_id = ?
        WHERE payment_id = ?
      `,
      [
        nextPayment.amount,
        nextPayment.currency,
        nextPayment.paymentStatus,
        nextPayment.paymentReference,
        nextPayment.paymentDate,
        nextPayment.paymentMethod,
        nextPayment.notes,
        actorUserId,
        paymentId
      ]
    );

    if (paymentFieldChanges.length > 0) {
      await auditLogsModel.createInvoiceAuditLog(connection, {
        invoiceId: existingPayment.invoiceId,
        actorUserId,
        eventType: auditLogsModel.AUDIT_EVENT_TYPES.PAYMENT_UPDATED,
        actionLabel: "Updated payment",
        targetType: auditLogsModel.AUDIT_TARGET_TYPES.PAYMENT,
        targetId: paymentId,
        changedFields: paymentFieldChanges
      });
    }

    await synchronizeInvoicePaymentState(connection, existingPayment.invoiceId, actorUserId);

    await connection.commit();
    return getPaymentById(paymentId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  PAYMENT_STATUSES,
  listPayableInvoices,
  listPayments,
  getPaymentById,
  createPayment,
  updatePayment
};
