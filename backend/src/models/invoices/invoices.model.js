const ApiError = require("../../utils/ApiError");
const { pool } = require("../../config/database");
const { APPROVAL_MANAGED_STATUSES } = require("../approvals/approvals.model");
const auditLogsModel = require("../auditLogs/auditLogs.model");

function parseExtractedFields(value) {
  if (!value) {
    return null;
  }

  if (typeof value === "object") {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch (error) {
    return null;
  }
}

function buildNormalizedExtractionField(value, confidence = "low", source = null) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return {
      value: value.value ?? null,
      confidence: value.confidence || confidence,
      source: value.source || source
    };
  }

  return {
    value: value ?? null,
    confidence,
    source
  };
}

function normalizeExtractionData(value, extractionStatus, extractionConfidence) {
  const parsedValue = parseExtractedFields(value);

  if (!parsedValue) {
    return null;
  }

  if (parsedValue.fields && typeof parsedValue.fields === "object") {
    return {
      providerId: parsedValue.providerId || "unknown",
      providerVersion: parsedValue.providerVersion || "unknown",
      extractionStatus: parsedValue.extractionStatus || extractionStatus || "not_started",
      overallConfidence: parsedValue.overallConfidence || extractionConfidence || null,
      fields: {
        invoiceNumber: buildNormalizedExtractionField(parsedValue.fields.invoiceNumber),
        invoiceDate: buildNormalizedExtractionField(parsedValue.fields.invoiceDate),
        dueDate: buildNormalizedExtractionField(parsedValue.fields.dueDate),
        subtotal: buildNormalizedExtractionField(parsedValue.fields.subtotal),
        tax: buildNormalizedExtractionField(parsedValue.fields.tax),
        total: buildNormalizedExtractionField(parsedValue.fields.total),
        currency: buildNormalizedExtractionField(parsedValue.fields.currency)
      },
      notes: Array.isArray(parsedValue.notes) ? parsedValue.notes : [],
      source: parsedValue.source || null
    };
  }

  const legacyFields = parsedValue.extractedFields || parsedValue;

  return {
    providerId: parsedValue.providerId || "legacy",
    providerVersion: parsedValue.extractionVersion || "legacy",
    extractionStatus: parsedValue.extractionStatus || extractionStatus || "not_started",
    overallConfidence: parsedValue.overallConfidence || extractionConfidence || "low",
    fields: {
      invoiceNumber: buildNormalizedExtractionField(legacyFields.invoiceNumber),
      invoiceDate: buildNormalizedExtractionField(legacyFields.invoiceDate),
      dueDate: buildNormalizedExtractionField(legacyFields.dueDate),
      subtotal: buildNormalizedExtractionField(legacyFields.subtotal),
      tax: buildNormalizedExtractionField(legacyFields.tax),
      total: buildNormalizedExtractionField(legacyFields.total),
      currency: buildNormalizedExtractionField(legacyFields.currency)
    },
    notes: Array.isArray(parsedValue.notes) ? parsedValue.notes : [],
    source: parsedValue.sourceEmail || parsedValue.source || null
  };
}

function mapInvoiceRow(row) {
  if (!row) {
    return null;
  }

  return {
    invoiceId: row.invoiceId,
    supplierId: row.supplierId,
    supplierName: row.supplierName,
    invoiceNumber: row.invoiceNumber,
    invoiceDate: row.invoiceDate,
    dueDate: row.dueDate,
    subtotal: row.subtotal === null ? null : Number(row.subtotal),
    tax: row.tax === null ? null : Number(row.tax),
    total: row.total === null ? null : Number(row.total),
    currency: row.currency,
    externalPoNumber: row.externalPoNumber,
    externalPoVerified: Boolean(row.externalPoVerified),
    verificationNotes: row.verificationNotes,
    assignedUserId: row.assignedUserId,
    assignedUserName: row.assignedUserName,
    status: row.status,
    paymentStatus: row.paymentStatus || "unpaid",
    duplicateFlag: Boolean(row.duplicateFlag),
    holdReason: row.holdReason,
    extractionStatus: row.extractionStatus || "not_started",
    extractionConfidence: row.extractionConfidence,
    extractionData: normalizeExtractionData(
      row.extractedFields,
      row.extractionStatus,
      row.extractionConfidence
    ),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function buildInvoiceListWhereClause(filters) {
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

  if (typeof filters.duplicateFlag === "boolean") {
    clauses.push("i.duplicate_flag = ?");
    params.push(filters.duplicateFlag ? 1 : 0);
  }

  if (typeof filters.onHold === "boolean") {
    clauses.push(filters.onHold ? "i.hold_reason IS NOT NULL" : "i.hold_reason IS NULL");
  }

  if (filters.currency) {
    clauses.push("i.currency = ?");
    params.push(filters.currency);
  }

  return {
    whereClause: clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "",
    params
  };
}

async function listInvoices(filters = {}) {
  const { whereClause, params } = buildInvoiceListWhereClause(filters);
  const [rows] = await pool.query(
    `
      SELECT
        i.invoice_id AS invoiceId,
        i.supplier_id AS supplierId,
        s.supplier_name AS supplierName,
        i.invoice_number AS invoiceNumber,
        DATE_FORMAT(i.invoice_date, '%Y-%m-%d') AS invoiceDate,
        DATE_FORMAT(i.due_date, '%Y-%m-%d') AS dueDate,
        i.subtotal AS subtotal,
        i.tax_amount AS tax,
        i.total_amount AS total,
        i.currency,
        i.external_po_number AS externalPoNumber,
        i.external_po_verified AS externalPoVerified,
        i.verification_notes AS verificationNotes,
        i.assigned_to AS assignedUserId,
        TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))) AS assignedUserName,
        i.status,
        i.payment_status AS paymentStatus,
        i.duplicate_flag AS duplicateFlag,
        i.hold_reason AS holdReason,
        i.extraction_status AS extractionStatus,
        i.extraction_confidence AS extractionConfidence,
        i.extracted_data_json AS extractedFields,
        i.created_at AS createdAt,
        i.updated_at AS updatedAt,
        COUNT(DISTINCT ic.invoice_comment_id) AS commentCount,
        COUNT(DISTINCT f.invoice_file_id) AS attachmentCount
      FROM invoices i
      INNER JOIN suppliers s ON s.supplier_id = i.supplier_id
      LEFT JOIN users u ON u.user_id = i.assigned_to
      LEFT JOIN invoice_comments ic ON ic.invoice_id = i.invoice_id
      LEFT JOIN invoice_files f ON f.invoice_id = i.invoice_id
      ${whereClause}
      GROUP BY
        i.invoice_id,
        i.supplier_id,
        s.supplier_name,
        i.invoice_number,
        i.invoice_date,
        i.due_date,
        i.subtotal,
        i.tax_amount,
        i.total_amount,
        i.currency,
        i.external_po_number,
        i.external_po_verified,
        i.verification_notes,
        i.assigned_to,
        u.first_name,
        u.last_name,
        i.status,
        i.payment_status,
        i.duplicate_flag,
        i.hold_reason,
        i.extraction_status,
        i.extraction_confidence,
        i.extracted_data_json,
        i.created_at,
        i.updated_at
      ORDER BY i.updated_at DESC, i.invoice_id DESC
    `,
    params
  );

  return rows.map((row) => ({
    ...mapInvoiceRow(row),
    commentCount: Number(row.commentCount),
    attachmentCount: Number(row.attachmentCount)
  }));
}

async function findInvoiceById(invoiceId) {
  const [rows] = await pool.query(
    `
      SELECT
        i.invoice_id AS invoiceId,
        i.supplier_id AS supplierId,
        s.supplier_name AS supplierName,
        i.invoice_number AS invoiceNumber,
        DATE_FORMAT(i.invoice_date, '%Y-%m-%d') AS invoiceDate,
        DATE_FORMAT(i.due_date, '%Y-%m-%d') AS dueDate,
        i.subtotal AS subtotal,
        i.tax_amount AS tax,
        i.total_amount AS total,
        i.currency,
        i.external_po_number AS externalPoNumber,
        i.external_po_verified AS externalPoVerified,
        i.verification_notes AS verificationNotes,
        i.assigned_to AS assignedUserId,
        TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))) AS assignedUserName,
        i.status,
        i.payment_status AS paymentStatus,
        i.duplicate_flag AS duplicateFlag,
        i.hold_reason AS holdReason,
        i.extraction_status AS extractionStatus,
        i.extraction_confidence AS extractionConfidence,
        i.extracted_data_json AS extractedFields,
        i.created_at AS createdAt,
        i.updated_at AS updatedAt
      FROM invoices i
      INNER JOIN suppliers s ON s.supplier_id = i.supplier_id
      LEFT JOIN users u ON u.user_id = i.assigned_to
      WHERE i.invoice_id = ?
      LIMIT 1
    `,
    [invoiceId]
  );

  return mapInvoiceRow(rows[0] || null);
}

async function getInvoiceComments(invoiceId, executor = pool) {
  const [rows] = await executor.query(
    `
      SELECT
        ic.invoice_comment_id AS commentId,
        ic.comment_text AS commentText,
        ic.is_internal AS isInternal,
        ic.created_at AS createdAt,
        ic.updated_at AS updatedAt,
        ic.created_by_user_id AS createdByUserId,
        TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))) AS createdByUserName
      FROM invoice_comments ic
      INNER JOIN users u ON u.user_id = ic.created_by_user_id
      WHERE ic.invoice_id = ?
      ORDER BY ic.created_at DESC, ic.invoice_comment_id DESC
    `,
    [invoiceId]
  );

  return rows.map((row) => ({
    commentId: row.commentId,
    commentText: row.commentText,
    isInternal: Boolean(row.isInternal),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    createdByUserId: row.createdByUserId,
    createdByUserName: row.createdByUserName
  }));
}

async function getInvoiceStatusHistory(invoiceId, executor = pool) {
  const [rows] = await executor.query(
    `
      SELECT
        h.invoice_status_history_id AS statusHistoryId,
        h.from_status AS fromStatus,
        h.to_status AS toStatus,
        h.change_reason AS changeReason,
        h.changed_at AS changedAt,
        h.changed_by_user_id AS changedByUserId,
        TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))) AS changedByUserName
      FROM invoice_status_history h
      LEFT JOIN users u ON u.user_id = h.changed_by_user_id
      WHERE h.invoice_id = ?
      ORDER BY h.changed_at DESC, h.invoice_status_history_id DESC
    `,
    [invoiceId]
  );

  return rows.map((row) => ({
    statusHistoryId: row.statusHistoryId,
    fromStatus: row.fromStatus,
    toStatus: row.toStatus,
    changeReason: row.changeReason,
    changedAt: row.changedAt,
    changedByUserId: row.changedByUserId,
    changedByUserName: row.changedByUserName
  }));
}

async function getInvoiceAttachments(invoiceId, executor = pool) {
  const [rows] = await executor.query(
    `
      SELECT
        invoice_file_id AS attachmentId,
        file_name AS fileName,
        original_file_name AS originalFileName,
        mime_type AS mimeType,
        file_size_bytes AS fileSizeBytes,
        file_checksum_sha256 AS fileChecksumSha256,
        storage_provider AS storageProvider,
        storage_path AS storagePath,
        is_primary_document AS isPrimaryDocument,
        uploaded_at AS uploadedAt
      FROM invoice_files
      WHERE invoice_id = ?
      ORDER BY is_primary_document DESC, uploaded_at DESC, invoice_file_id DESC
    `,
    [invoiceId]
  );

  return rows.map((row) => ({
    attachmentId: row.attachmentId,
    fileName: row.fileName,
    originalFileName: row.originalFileName,
    mimeType: row.mimeType,
    fileSizeBytes: Number(row.fileSizeBytes),
    fileChecksumSha256: row.fileChecksumSha256,
    storageProvider: row.storageProvider,
    storagePath: row.storagePath,
    isPrimaryDocument: Boolean(row.isPrimaryDocument),
    uploadedAt: row.uploadedAt
  }));
}

async function getInvoicePayments(invoiceId, executor = pool) {
  const [rows] = await executor.query(
    `
      SELECT
        p.payment_id AS paymentId,
        p.invoice_id AS invoiceId,
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
      LEFT JOIN users cu ON cu.user_id = p.created_by_user_id
      LEFT JOIN users uu ON uu.user_id = p.updated_by_user_id
      WHERE p.invoice_id = ?
      ORDER BY p.updated_at DESC, p.payment_id DESC
    `,
    [invoiceId]
  );

  return rows.map((row) => ({
    paymentId: row.paymentId,
    invoiceId: row.invoiceId,
    amount: row.amount === null ? null : Number(row.amount),
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
  }));
}

async function getInvoiceAuditHistory(invoiceId, executor = pool) {
  return auditLogsModel.listInvoiceAuditLogs(invoiceId, executor);
}

async function buildInvoiceDetail(invoiceId) {
  const invoice = await findInvoiceById(invoiceId);

  if (!invoice) {
    return null;
  }

  const [comments, statusHistory, attachmentMetadata, payments, auditHistory] = await Promise.all([
    getInvoiceComments(invoiceId),
    getInvoiceStatusHistory(invoiceId),
    getInvoiceAttachments(invoiceId),
    getInvoicePayments(invoiceId),
    getInvoiceAuditHistory(invoiceId)
  ]);

  return {
    ...invoice,
    comments,
    statusHistory,
    attachmentMetadata,
    payments,
    auditHistory
  };
}

function buildInvoiceCreateAuditChanges(payload) {
  return [
    {
      field: "supplierId",
      label: "Supplier",
      from: null,
      to: payload.supplierId
    },
    {
      field: "invoiceNumber",
      label: "Invoice number",
      from: null,
      to: payload.invoiceNumber
    },
    {
      field: "invoiceDate",
      label: "Invoice date",
      from: null,
      to: payload.invoiceDate
    },
    {
      field: "dueDate",
      label: "Due date",
      from: null,
      to: payload.dueDate
    },
    {
      field: "subtotal",
      label: "Subtotal",
      from: null,
      to: payload.subtotal
    },
    {
      field: "tax",
      label: "Tax",
      from: null,
      to: payload.tax
    },
    {
      field: "total",
      label: "Total",
      from: null,
      to: payload.total
    },
    {
      field: "currency",
      label: "Currency",
      from: null,
      to: payload.currency
    },
    {
      field: "assignedUserId",
      label: "Assigned user",
      from: null,
      to: payload.assignedUserId
    },
    {
      field: "status",
      label: "Status",
      from: null,
      to: payload.status
    }
  ].filter((change) => change.to !== undefined);
}

async function ensureSupplierExists(connection, supplierId) {
  const [rows] = await connection.query(
    `
      SELECT supplier_id AS supplierId
      FROM suppliers
      WHERE supplier_id = ?
      LIMIT 1
    `,
    [supplierId]
  );

  if (!rows[0]) {
    throw new ApiError(400, "Selected supplier was not found.");
  }
}

async function ensureUserExists(connection, userId) {
  if (!userId) {
    return;
  }

  const [rows] = await connection.query(
    `
      SELECT user_id AS userId
      FROM users
      WHERE user_id = ?
        AND is_active = 1
      LIMIT 1
    `,
    [userId]
  );

  if (!rows[0]) {
    throw new ApiError(400, "Selected assigned user was not found.");
  }
}

async function replaceAttachmentMetadata(connection, invoiceId, attachmentMetadata, actorUserId) {
  if (attachmentMetadata === undefined) {
    return;
  }

  await connection.query("DELETE FROM invoice_files WHERE invoice_id = ?", [invoiceId]);

  if (!attachmentMetadata || attachmentMetadata.length === 0) {
    return;
  }

  const values = attachmentMetadata.map((attachment) => [
    invoiceId,
    attachment.fileName,
    attachment.originalFileName,
    attachment.mimeType,
    attachment.fileSizeBytes,
    attachment.fileChecksumSha256,
    attachment.storageProvider,
    attachment.storagePath,
    attachment.isPrimaryDocument ? 1 : 0,
    attachment.uploadedAt,
    actorUserId,
    actorUserId
  ]);

  await connection.query(
    `
      INSERT INTO invoice_files (
        invoice_id,
        file_name,
        original_file_name,
        mime_type,
        file_size_bytes,
        file_checksum_sha256,
        storage_provider,
        storage_path,
        is_primary_document,
        uploaded_at,
        created_by_user_id,
        updated_by_user_id
      )
      VALUES ?
    `,
    [values]
  );
}

async function insertStatusHistory(connection, invoiceId, fromStatus, toStatus, changeReason, actorUserId) {
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
    [invoiceId, fromStatus, toStatus, changeReason || null, actorUserId]
  );
}

async function createInvoice(payload, actorUserId) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    if (APPROVAL_MANAGED_STATUSES.has(payload.status)) {
      throw new ApiError(400, "Approval-managed statuses are set automatically by the approval workflow.");
    }

    await ensureSupplierExists(connection, payload.supplierId);
    await ensureUserExists(connection, payload.assignedUserId);

    const [result] = await connection.query(
      `
        INSERT INTO invoices (
          supplier_id,
          invoice_number,
          invoice_date,
          due_date,
          subtotal,
          tax_amount,
          total_amount,
          currency,
          external_po_number,
          external_po_verified,
          external_po_verified_at,
          verification_notes,
          assigned_to,
          status,
          duplicate_flag,
          hold_reason,
          extraction_status,
          extraction_confidence,
          extracted_data_json,
          created_by_user_id,
          updated_by_user_id
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        payload.supplierId,
        payload.invoiceNumber,
        payload.invoiceDate,
        payload.dueDate,
        payload.subtotal,
        payload.tax,
        payload.total,
        payload.currency,
        payload.externalPoNumber,
        payload.externalPoVerified ? 1 : 0,
        payload.externalPoVerified ? new Date() : null,
        payload.verificationNotes,
        payload.assignedUserId,
        payload.status,
        payload.duplicateFlag ? 1 : 0,
        payload.holdReason,
        payload.extractionStatus || "not_started",
        payload.extractionConfidence || null,
        payload.extractionData ? JSON.stringify(payload.extractionData) : null,
        actorUserId,
        actorUserId
      ]
    );

    await replaceAttachmentMetadata(
      connection,
      result.insertId,
      payload.attachmentMetadata,
      actorUserId
    );
    await insertStatusHistory(connection, result.insertId, null, payload.status, "Invoice created", actorUserId);
    await auditLogsModel.createInvoiceAuditLog(connection, {
      invoiceId: result.insertId,
      actorUserId,
      eventType: auditLogsModel.AUDIT_EVENT_TYPES.INVOICE_CREATED,
      actionLabel: "Created invoice",
      changedFields: buildInvoiceCreateAuditChanges(payload),
      metadata: {
        attachmentCount: Array.isArray(payload.attachmentMetadata) ? payload.attachmentMetadata.length : 0
      }
    });

    await connection.commit();
    return buildInvoiceDetail(result.insertId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function updateInvoice(invoiceId, payload, actorUserId) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [existingRows] = await connection.query(
      `
        SELECT
          invoice_id AS invoiceId,
          supplier_id AS supplierId,
          invoice_number AS invoiceNumber,
          DATE_FORMAT(invoice_date, '%Y-%m-%d') AS invoiceDate,
          DATE_FORMAT(due_date, '%Y-%m-%d') AS dueDate,
          subtotal,
          tax_amount AS tax,
          total_amount AS total,
          currency,
          external_po_number AS externalPoNumber,
          external_po_verified AS externalPoVerified,
          verification_notes AS verificationNotes,
          assigned_to AS assignedUserId,
          status,
          duplicate_flag AS duplicateFlag,
          hold_reason AS holdReason,
          extraction_status AS extractionStatus,
          extraction_confidence AS extractionConfidence,
          extracted_data_json AS extractedFields
        FROM invoices
        WHERE invoice_id = ?
        LIMIT 1
      `,
      [invoiceId]
    );

    const existingInvoice = existingRows[0];

    if (!existingInvoice) {
      throw new ApiError(404, "Invoice not found.");
    }

    const existingAttachments =
      payload.attachmentMetadata === undefined ? null : await getInvoiceAttachments(invoiceId, connection);

    const nextInvoice = {
      supplierId:
        payload.supplierId === undefined ? existingInvoice.supplierId : payload.supplierId,
      invoiceNumber:
        payload.invoiceNumber === undefined ? existingInvoice.invoiceNumber : payload.invoiceNumber,
      invoiceDate:
        payload.invoiceDate === undefined ? existingInvoice.invoiceDate : payload.invoiceDate,
      dueDate: payload.dueDate === undefined ? existingInvoice.dueDate : payload.dueDate,
      subtotal: payload.subtotal === undefined ? existingInvoice.subtotal : payload.subtotal,
      tax: payload.tax === undefined ? existingInvoice.tax : payload.tax,
      total: payload.total === undefined ? existingInvoice.total : payload.total,
      currency: payload.currency === undefined ? existingInvoice.currency : payload.currency,
      externalPoNumber:
        payload.externalPoNumber === undefined
          ? existingInvoice.externalPoNumber
          : payload.externalPoNumber,
      externalPoVerified:
        payload.externalPoVerified === undefined
          ? Boolean(existingInvoice.externalPoVerified)
          : payload.externalPoVerified,
      verificationNotes:
        payload.verificationNotes === undefined
          ? existingInvoice.verificationNotes
          : payload.verificationNotes,
      assignedUserId:
        payload.assignedUserId === undefined
          ? existingInvoice.assignedUserId
          : payload.assignedUserId,
      status: payload.status === undefined ? existingInvoice.status : payload.status,
      duplicateFlag:
        payload.duplicateFlag === undefined
          ? Boolean(existingInvoice.duplicateFlag)
          : payload.duplicateFlag,
      holdReason:
        payload.holdReason === undefined ? existingInvoice.holdReason : payload.holdReason,
      extractionStatus:
        payload.extractionStatus === undefined
          ? existingInvoice.extractionStatus
          : payload.extractionStatus,
      extractionConfidence:
        payload.extractionConfidence === undefined
          ? existingInvoice.extractionConfidence
          : payload.extractionConfidence,
      extractionData:
        payload.extractionData === undefined ? existingInvoice.extractedFields : payload.extractionData
    };

    if (
      payload.status !== undefined &&
      existingInvoice.status !== payload.status &&
      (APPROVAL_MANAGED_STATUSES.has(existingInvoice.status) || APPROVAL_MANAGED_STATUSES.has(payload.status))
    ) {
      throw new ApiError(400, "Approval-managed statuses can only be changed through approval actions.");
    }

    await ensureSupplierExists(connection, nextInvoice.supplierId);
    await ensureUserExists(connection, nextInvoice.assignedUserId);

    const statusChange = auditLogsModel.buildFieldChange(
      "status",
      "Status",
      existingInvoice.status,
      nextInvoice.status
    );
    const assignmentChange = auditLogsModel.buildFieldChange(
      "assignedUserId",
      "Assigned user",
      existingInvoice.assignedUserId,
      nextInvoice.assignedUserId
    );
    const verificationChanges = [
      auditLogsModel.buildFieldChange(
        "externalPoVerified",
        "External PO verified",
        Boolean(existingInvoice.externalPoVerified),
        Boolean(nextInvoice.externalPoVerified)
      ),
      auditLogsModel.buildFieldChange(
        "verificationNotes",
        "Verification notes",
        existingInvoice.verificationNotes,
        nextInvoice.verificationNotes
      )
    ].filter(Boolean);
    const invoiceFieldChanges = [
      auditLogsModel.buildFieldChange("supplierId", "Supplier", existingInvoice.supplierId, nextInvoice.supplierId),
      auditLogsModel.buildFieldChange(
        "invoiceNumber",
        "Invoice number",
        existingInvoice.invoiceNumber,
        nextInvoice.invoiceNumber
      ),
      auditLogsModel.buildFieldChange("invoiceDate", "Invoice date", existingInvoice.invoiceDate, nextInvoice.invoiceDate),
      auditLogsModel.buildFieldChange("dueDate", "Due date", existingInvoice.dueDate, nextInvoice.dueDate),
      auditLogsModel.buildFieldChange("subtotal", "Subtotal", existingInvoice.subtotal, nextInvoice.subtotal),
      auditLogsModel.buildFieldChange("tax", "Tax", existingInvoice.tax, nextInvoice.tax),
      auditLogsModel.buildFieldChange("total", "Total", existingInvoice.total, nextInvoice.total),
      auditLogsModel.buildFieldChange("currency", "Currency", existingInvoice.currency, nextInvoice.currency),
      auditLogsModel.buildFieldChange(
        "externalPoNumber",
        "External PO number",
        existingInvoice.externalPoNumber,
        nextInvoice.externalPoNumber
      ),
      auditLogsModel.buildFieldChange(
        "duplicateFlag",
        "Duplicate flag",
        Boolean(existingInvoice.duplicateFlag),
        Boolean(nextInvoice.duplicateFlag)
      ),
      auditLogsModel.buildFieldChange("holdReason", "Hold reason", existingInvoice.holdReason, nextInvoice.holdReason),
      auditLogsModel.buildFieldChange(
        "extractionStatus",
        "Extraction status",
        existingInvoice.extractionStatus,
        nextInvoice.extractionStatus
      ),
      auditLogsModel.buildFieldChange(
        "extractionConfidence",
        "Extraction confidence",
        existingInvoice.extractionConfidence,
        nextInvoice.extractionConfidence
      ),
      auditLogsModel.buildFieldChange(
        "extractionData",
        "Extraction data",
        existingInvoice.extractedFields,
        nextInvoice.extractionData
      ),
      payload.attachmentMetadata === undefined
        ? null
        : auditLogsModel.buildFieldChange(
            "attachmentMetadata",
            "Attachment metadata",
            existingAttachments,
            payload.attachmentMetadata
          )
    ].filter(Boolean);

    await connection.query(
      `
        UPDATE invoices
        SET
          supplier_id = ?,
          invoice_number = ?,
          invoice_date = ?,
          due_date = ?,
          subtotal = ?,
          tax_amount = ?,
          total_amount = ?,
          currency = ?,
          external_po_number = ?,
          external_po_verified = ?,
          external_po_verified_at = ?,
          verification_notes = ?,
          assigned_to = ?,
          status = ?,
          duplicate_flag = ?,
          hold_reason = ?,
          extraction_status = ?,
          extraction_confidence = ?,
          extracted_data_json = ?,
          updated_by_user_id = ?
        WHERE invoice_id = ?
      `,
      [
        nextInvoice.supplierId,
        nextInvoice.invoiceNumber,
        nextInvoice.invoiceDate,
        nextInvoice.dueDate,
        nextInvoice.subtotal,
        nextInvoice.tax,
        nextInvoice.total,
        nextInvoice.currency,
        nextInvoice.externalPoNumber,
        nextInvoice.externalPoVerified ? 1 : 0,
        nextInvoice.externalPoVerified ? new Date() : null,
        nextInvoice.verificationNotes,
        nextInvoice.assignedUserId,
        nextInvoice.status,
        nextInvoice.duplicateFlag ? 1 : 0,
        nextInvoice.holdReason,
        nextInvoice.extractionStatus,
        nextInvoice.extractionConfidence,
        nextInvoice.extractionData
          ? typeof nextInvoice.extractionData === "string"
            ? nextInvoice.extractionData
            : JSON.stringify(nextInvoice.extractionData)
          : null,
        actorUserId,
        invoiceId
      ]
    );

    if (existingInvoice.status !== nextInvoice.status) {
      await insertStatusHistory(
        connection,
        invoiceId,
        existingInvoice.status,
        nextInvoice.status,
        payload.statusChangeReason || payload.holdReason || payload.verificationNotes || null,
        actorUserId
      );
    }

    await replaceAttachmentMetadata(connection, invoiceId, payload.attachmentMetadata, actorUserId);

    if (invoiceFieldChanges.length > 0) {
      await auditLogsModel.createInvoiceAuditLog(connection, {
        invoiceId,
        actorUserId,
        eventType: auditLogsModel.AUDIT_EVENT_TYPES.INVOICE_UPDATED,
        actionLabel: "Updated invoice fields",
        changedFields: invoiceFieldChanges
      });
    }

    if (assignmentChange) {
      await auditLogsModel.createInvoiceAuditLog(connection, {
        invoiceId,
        actorUserId,
        eventType: auditLogsModel.AUDIT_EVENT_TYPES.ASSIGNMENT_CHANGED,
        actionLabel: "Changed assignment",
        changedFields: [assignmentChange]
      });
    }

    if (verificationChanges.length > 0) {
      await auditLogsModel.createInvoiceAuditLog(connection, {
        invoiceId,
        actorUserId,
        eventType: auditLogsModel.AUDIT_EVENT_TYPES.VERIFICATION_CHANGED,
        actionLabel: "Updated verification",
        changedFields: verificationChanges
      });
    }

    if (statusChange) {
      await auditLogsModel.createInvoiceAuditLog(connection, {
        invoiceId,
        actorUserId,
        eventType: auditLogsModel.AUDIT_EVENT_TYPES.STATUS_CHANGED,
        actionLabel: "Changed invoice status",
        changedFields: [statusChange],
        metadata: {
          reason: payload.statusChangeReason || payload.holdReason || payload.verificationNotes || null
        }
      });
    }

    await connection.commit();
    return buildInvoiceDetail(invoiceId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function deleteInvoice(invoiceId) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [invoiceRows] = await connection.query(
      `
        SELECT invoice_id AS invoiceId
        FROM invoices
        WHERE invoice_id = ?
        LIMIT 1
      `,
      [invoiceId]
    );

    if (!invoiceRows[0]) {
      await connection.rollback();
      return false;
    }

    await connection.query("DELETE FROM approval_actions WHERE invoice_id = ?", [invoiceId]);
    await connection.query("DELETE FROM invoice_audit_logs WHERE invoice_id = ?", [invoiceId]);
    await connection.query("DELETE FROM invoice_status_history WHERE invoice_id = ?", [invoiceId]);
    await connection.query("DELETE FROM invoice_comments WHERE invoice_id = ?", [invoiceId]);
    await connection.query("DELETE FROM invoice_items WHERE invoice_id = ?", [invoiceId]);
    await connection.query("DELETE FROM invoice_files WHERE invoice_id = ?", [invoiceId]);
    await connection.query("DELETE FROM payments WHERE invoice_id = ?", [invoiceId]);
    await connection.query("DELETE FROM invoices WHERE invoice_id = ?", [invoiceId]);

    await connection.commit();
    return true;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function createComment(invoiceId, payload, actorUserId) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [existingRows] = await connection.query(
      `
        SELECT invoice_id AS invoiceId
        FROM invoices
        WHERE invoice_id = ?
        LIMIT 1
      `,
      [invoiceId]
    );

    if (!existingRows[0]) {
      throw new ApiError(404, "Invoice not found.");
    }

    const [result] = await connection.query(
      `
        INSERT INTO invoice_comments (
          invoice_id,
          comment_text,
          is_internal,
          created_by_user_id,
          updated_by_user_id
        )
        VALUES (?, ?, ?, ?, ?)
      `,
      [invoiceId, payload.commentText, payload.isInternal ? 1 : 0, actorUserId, actorUserId]
    );

    await auditLogsModel.createInvoiceAuditLog(connection, {
      invoiceId,
      actorUserId,
      eventType: auditLogsModel.AUDIT_EVENT_TYPES.COMMENT_ADDED,
      actionLabel: payload.isInternal ? "Added internal comment" : "Added shared comment",
      targetType: auditLogsModel.AUDIT_TARGET_TYPES.COMMENT,
      targetId: result.insertId,
      changedFields: [
        {
          field: "commentText",
          label: "Comment",
          from: null,
          to: payload.commentText
        }
      ],
      metadata: {
        isInternal: Boolean(payload.isInternal)
      }
    });

    await connection.commit();

    const [rows] = await pool.query(
    `
      SELECT
        ic.invoice_comment_id AS commentId,
        ic.comment_text AS commentText,
        ic.is_internal AS isInternal,
        ic.created_at AS createdAt,
        ic.updated_at AS updatedAt,
        ic.created_by_user_id AS createdByUserId,
        TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))) AS createdByUserName
      FROM invoice_comments ic
      INNER JOIN users u ON u.user_id = ic.created_by_user_id
      WHERE ic.invoice_comment_id = ?
      LIMIT 1
    `,
    [result.insertId]
  );

    const row = rows[0];

    return {
      commentId: row.commentId,
      commentText: row.commentText,
      isInternal: Boolean(row.isInternal),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      createdByUserId: row.createdByUserId,
      createdByUserName: row.createdByUserName
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function getInvoiceMeta() {
  const [suppliers, users] = await Promise.all([
    pool.query(
      `
        SELECT
          supplier_id AS supplierId,
          supplier_name AS supplierName,
          default_currency AS defaultCurrency
        FROM suppliers
        WHERE is_active = 1
        ORDER BY supplier_name ASC
      `
    ),
    pool.query(
      `
        SELECT
          user_id AS userId,
          first_name AS firstName,
          last_name AS lastName,
          email
        FROM users
        WHERE is_active = 1
        ORDER BY first_name ASC, last_name ASC, email ASC
      `
    )
  ]);

  return {
    suppliers: suppliers[0],
    users: users[0].map((user) => ({
      userId: user.userId,
      fullName: `${user.firstName || ""} ${user.lastName || ""}`.trim(),
      email: user.email
    }))
  };
}

module.exports = {
  buildInvoiceDetail,
  createComment,
  createInvoice,
  deleteInvoice,
  findInvoiceById,
  getInvoiceMeta,
  listInvoices,
  updateInvoice
};
