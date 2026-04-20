const path = require("path");

const { pool } = require("../../config/database");

const UNMATCHED_SUPPLIER_CODE = "EMAIL-IMPORT-UNMATCHED";
const UNMATCHED_SUPPLIER_NAME = "Unmatched Email Imports";

function normalizeEmail(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : null;
}

function toMysqlDateTime(value) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString().slice(0, 19).replace("T", " ");
}

function toMysqlDate(value) {
  const dateTime = toMysqlDateTime(value);
  return dateTime ? dateTime.slice(0, 10) : null;
}

async function findEmailImportByMessageId(connection, messageId) {
  const executor = connection || pool;
  const [rows] = await executor.query(
    `
      SELECT
        invoice_email_import_id AS invoiceEmailImportId,
        processing_status AS processingStatus
      FROM invoice_email_imports
      WHERE message_id = ?
      LIMIT 1
    `,
    [messageId]
  );

  return rows[0] || null;
}

async function createInvoiceEmailImport(connection, payload) {
  const [result] = await connection.query(
    `
      INSERT INTO invoice_email_imports (
        mailbox_name,
        message_id,
        thread_id,
        sender_email,
        sender_name,
        recipient_email,
        subject,
        received_at,
        processing_status,
        processing_notes,
        attachment_count,
        raw_email_storage_path,
        created_by_user_id,
        updated_by_user_id
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      payload.mailboxName,
      payload.messageId,
      payload.threadId,
      payload.senderEmail,
      payload.senderName,
      payload.recipientEmail,
      payload.subject,
      toMysqlDateTime(payload.receivedAt),
      payload.processingStatus,
      payload.processingNotes,
      payload.attachmentCount,
      payload.rawEmailStoragePath,
      payload.actorUserId || null,
      payload.actorUserId || null
    ]
  );

  return result.insertId;
}

async function updateInvoiceEmailImport(connection, invoiceEmailImportId, payload) {
  await connection.query(
    `
      UPDATE invoice_email_imports
      SET
        processing_status = ?,
        processing_notes = ?,
        attachment_count = ?,
        raw_email_storage_path = ?,
        updated_by_user_id = ?
      WHERE invoice_email_import_id = ?
    `,
    [
      payload.processingStatus,
      payload.processingNotes,
      payload.attachmentCount,
      payload.rawEmailStoragePath,
      payload.actorUserId || null,
      invoiceEmailImportId
    ]
  );
}

async function ensureFallbackSupplier(connection) {
  const selectExistingSupplier = async () => {
    const [rows] = await connection.query(
      `
        SELECT
          supplier_id AS supplierId,
          default_currency AS defaultCurrency
        FROM suppliers
        WHERE supplier_code = ?
        LIMIT 1
      `,
      [UNMATCHED_SUPPLIER_CODE]
    );

    return rows[0] || null;
  };

  const existingSupplier = await selectExistingSupplier();

  if (existingSupplier) {
    return existingSupplier;
  }

  try {
    const [result] = await connection.query(
      `
        INSERT INTO suppliers (
          supplier_name,
          supplier_code,
          contact_email,
          payment_terms_days,
          default_currency,
          is_active
        )
        VALUES (?, ?, NULL, 30, 'USD', 1)
      `,
      [UNMATCHED_SUPPLIER_NAME, UNMATCHED_SUPPLIER_CODE]
    );

    return {
      supplierId: result.insertId,
      defaultCurrency: "USD"
    };
  } catch (error) {
    if (error.code !== "ER_DUP_ENTRY") {
      throw error;
    }

    return selectExistingSupplier();
  }
}

async function findSupplierForSender(connection, senderEmail) {
  const normalizedEmail = normalizeEmail(senderEmail);

  if (!normalizedEmail) {
    return null;
  }

  const [rows] = await connection.query(
    `
      SELECT
        supplier_id AS supplierId,
        supplier_name AS supplierName,
        default_currency AS defaultCurrency
      FROM suppliers
      WHERE LOWER(contact_email) = ?
        AND is_active = 1
      LIMIT 1
    `,
    [normalizedEmail]
  );

  return rows[0] || null;
}

async function resolveSupplierForImport(connection, senderEmail) {
  const matchedSupplier = await findSupplierForSender(connection, senderEmail);

  if (matchedSupplier) {
    return {
      supplierId: matchedSupplier.supplierId,
      defaultCurrency: matchedSupplier.defaultCurrency || "USD",
      supplierMatchStrategy: "contact_email"
    };
  }

  const fallbackSupplier = await ensureFallbackSupplier(connection);

  return {
    supplierId: fallbackSupplier.supplierId,
    defaultCurrency: fallbackSupplier.defaultCurrency || "USD",
    supplierMatchStrategy: "fallback_unmatched_supplier"
  };
}

async function createDraftInvoiceForAttachment(connection, payload) {
  const [invoiceResult] = await connection.query(
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
        verification_notes,
        status,
        source_email_id,
        extraction_status,
        extraction_confidence,
        extracted_data_json,
        created_by_user_id,
        updated_by_user_id
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      payload.supplierId,
      payload.invoiceNumber,
      toMysqlDate(payload.invoiceDate),
      payload.dueDate ? toMysqlDate(payload.dueDate) : null,
      payload.subtotal,
      payload.taxAmount,
      payload.totalAmount,
      payload.currency,
      payload.verificationNotes,
      payload.status,
      payload.invoiceEmailImportId,
      payload.extractionStatus,
      payload.extractionConfidence,
      JSON.stringify(payload.extractedData),
      payload.actorUserId || null,
      payload.actorUserId || null
    ]
  );

  const invoiceId = invoiceResult.insertId;

  await connection.query(
    `
      INSERT INTO invoice_files (
        invoice_id,
        invoice_email_import_id,
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
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      invoiceId,
      payload.invoiceEmailImportId,
      path.basename(payload.attachment.fileName),
      payload.attachment.originalFileName,
      payload.attachment.mimeType,
      payload.attachment.fileSizeBytes,
      payload.attachment.fileChecksumSha256,
      payload.attachment.storageProvider,
      payload.attachment.storagePath,
      1,
      toMysqlDateTime(payload.attachment.uploadedAt),
      payload.actorUserId || null,
      payload.actorUserId || null
    ]
  );

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
    [
      invoiceId,
      null,
      payload.status,
      "Created from imported email attachment",
      payload.actorUserId || null
    ]
  );

  return invoiceId;
}

module.exports = {
  createDraftInvoiceForAttachment,
  createInvoiceEmailImport,
  findEmailImportByMessageId,
  resolveSupplierForImport,
  updateInvoiceEmailImport
};
