const crypto = require("crypto");
const path = require("path");

const { ImapFlow } = require("imapflow");
const { simpleParser } = require("mailparser");

const { pool } = require("../../config/database");
const { env } = require("../../config/env");
const emailImportsModel = require("../../models/emailImports/emailImports.model");
const {
  removeImportArtifacts,
  saveAttachment,
  saveRawEmail
} = require("./emailStorage.service");
const {
  defaultInvoiceExtractionService
} = require("../invoiceExtraction/invoiceExtraction.service");

function normalizeAddress(addressValue) {
  if (!addressValue || !Array.isArray(addressValue.value) || addressValue.value.length === 0) {
    return {
      email: null,
      name: null
    };
  }

  const firstAddress = addressValue.value[0];

  return {
    email: firstAddress.address ? String(firstAddress.address).trim().toLowerCase() : null,
    name: firstAddress.name ? String(firstAddress.name).trim() : null
  };
}

function normalizeMessageId(parsedMail, rawBuffer) {
  const headerMessageId = parsedMail.messageId ? String(parsedMail.messageId).trim() : "";

  if (headerMessageId) {
    return headerMessageId;
  }

  const fingerprint = crypto.createHash("sha256").update(rawBuffer).digest("hex");
  return `missing-message-id:${fingerprint}`;
}

function buildEmailClient() {
  return new ImapFlow({
    host: env.emailImport.host,
    port: env.emailImport.port,
    secure: env.emailImport.secure,
    auth: {
      user: env.emailImport.user,
      pass: env.emailImport.password
    }
  });
}

function buildSearchCriteria() {
  const criteria = {
    since: new Date(Date.now() - env.emailImport.lookbackDays * 24 * 60 * 60 * 1000)
  };

  if (!env.emailImport.includeSeenMessages) {
    criteria.seen = false;
  }

  return criteria;
}

function getAllowedExtensions() {
  return new Set(env.emailImport.allowedExtensions.map((value) => value.toLowerCase()));
}

function isInvoiceAttachment(attachment, allowedExtensions) {
  if (!attachment || attachment.related) {
    return false;
  }

  const fileName = attachment.filename || "";
  const extension = path.extname(fileName).toLowerCase();

  if (allowedExtensions.has(extension)) {
    return true;
  }

  return ["application/pdf", "image/png", "image/jpeg", "image/tiff", "text/xml"].includes(
    attachment.contentType
  );
}

async function fetchCandidateMessages(client) {
  const uids = await client.search(buildSearchCriteria(), { uid: true });

  if (uids.length === 0) {
    return [];
  }

  const limitedUids = uids
    .slice()
    .sort((left, right) => right - left)
    .slice(0, env.emailImport.maxMessagesPerRun);

  const messages = [];

  for (const uid of limitedUids) {
    const metadata = await client.fetchOne(uid, {
      uid: true,
      envelope: true,
      internalDate: true,
      flags: true
    }, { uid: true });
    const sourceMessage = await client.fetchOne(uid, { source: true }, { uid: true });

    messages.push({
      uid,
      internalDate: metadata.internalDate,
      envelope: metadata.envelope,
      flags: metadata.flags,
      source: sourceMessage.source
    });
  }

  return messages;
}

async function parseCandidateMessage(message) {
  const rawSource = Buffer.isBuffer(message.source)
    ? message.source
    : Buffer.from(message.source || "");
  const parsedMail = await simpleParser(rawSource);
  const sender = normalizeAddress(parsedMail.from);
  const recipient = normalizeAddress(parsedMail.to);
  const messageId = normalizeMessageId(parsedMail, rawSource);
  const invoiceMessage = {
    uid: message.uid,
    subject: parsedMail.subject || message.envelope?.subject || null,
    senderEmail: sender.email,
    senderName: sender.name,
    recipientEmail: recipient.email,
    receivedAt: parsedMail.date || message.internalDate || new Date(),
    messageId,
    rawSource,
    attachments: Array.isArray(parsedMail.attachments) ? parsedMail.attachments : []
  };

  return invoiceMessage;
}

async function importSingleMessage(connection, invoiceMessage, actorUserId) {
  const duplicateImport = await emailImportsModel.findEmailImportByMessageId(
    connection,
    invoiceMessage.messageId
  );

  if (duplicateImport) {
    return {
      status: "duplicate",
      messageId: invoiceMessage.messageId,
      invoiceEmailImportId: duplicateImport.invoiceEmailImportId,
      createdInvoiceIds: []
    };
  }

  const rawEmail = await saveRawEmail(invoiceMessage);
  const allowedExtensions = getAllowedExtensions();
  const importableAttachments = [];

  for (let index = 0; index < invoiceMessage.attachments.length; index += 1) {
    const attachment = invoiceMessage.attachments[index];

    if (!isInvoiceAttachment(attachment, allowedExtensions)) {
      continue;
    }

    const savedAttachment = await saveAttachment(invoiceMessage, attachment, importableAttachments.length);
    importableAttachments.push(savedAttachment);
  }

  const processingNotes = importableAttachments.length
    ? "Imported attachments and created draft invoices. OCR/AI extraction is pending."
    : "No supported invoice attachments were found on the email.";

  let invoiceEmailImportId;

  try {
    invoiceEmailImportId = await emailImportsModel.createInvoiceEmailImport(connection, {
      mailboxName: env.emailImport.mailbox,
      messageId: invoiceMessage.messageId,
      threadId: null,
      senderEmail: invoiceMessage.senderEmail || "unknown@unknown",
      senderName: invoiceMessage.senderName,
      recipientEmail: invoiceMessage.recipientEmail,
      subject: invoiceMessage.subject,
      receivedAt: invoiceMessage.receivedAt,
      processingStatus: importableAttachments.length ? "imported" : "skipped",
      processingNotes,
      attachmentCount: importableAttachments.length,
      rawEmailStoragePath: rawEmail.storagePath,
      actorUserId
    });
  } catch (error) {
    if (error.code !== "ER_DUP_ENTRY") {
      throw error;
    }

    const existingImport = await emailImportsModel.findEmailImportByMessageId(
      connection,
      invoiceMessage.messageId
    );

    return {
      status: "duplicate",
      messageId: invoiceMessage.messageId,
      invoiceEmailImportId: existingImport?.invoiceEmailImportId || null,
      createdInvoiceIds: []
    };
  }

  const supplierResolution = await emailImportsModel.resolveSupplierForImport(
    connection,
    invoiceMessage.senderEmail
  );

  const createdInvoiceIds = [];

  for (let index = 0; index < importableAttachments.length; index += 1) {
    const attachment = importableAttachments[index];
    const extractedData = await defaultInvoiceExtractionService.extractImportedInvoiceFile({
      invoiceMessage,
      attachment,
      supplierResolution,
      attachmentIndex: index + 1
    });

    const invoiceId = await emailImportsModel.createDraftInvoiceForAttachment(connection, {
      invoiceEmailImportId,
      supplierId: supplierResolution.supplierId,
      invoiceNumber: extractedData.fields.invoiceNumber.value,
      invoiceDate: extractedData.fields.invoiceDate.value,
      dueDate: extractedData.fields.dueDate.value,
      subtotal: extractedData.fields.subtotal.value,
      taxAmount: extractedData.fields.tax.value,
      totalAmount: extractedData.fields.total.value,
      currency: extractedData.fields.currency.value || supplierResolution.defaultCurrency || "USD",
      verificationNotes: extractedData.notes.join(" "),
      status: "needs_review",
      extractionStatus: extractedData.extractionStatus,
      extractionConfidence: extractedData.overallConfidence,
      extractedData,
      attachment,
      actorUserId
    });

    createdInvoiceIds.push(invoiceId);
  }

  await emailImportsModel.updateInvoiceEmailImport(connection, invoiceEmailImportId, {
    processingStatus: importableAttachments.length ? "imported" : "skipped",
    processingNotes,
    attachmentCount: importableAttachments.length,
    rawEmailStoragePath: rawEmail.storagePath,
    actorUserId
  });

  return {
    status: importableAttachments.length ? "imported" : "skipped",
    messageId: invoiceMessage.messageId,
    invoiceEmailImportId,
    createdInvoiceIds
  };
}

async function importInvoicesFromEmailInbox(options = {}) {
  if (!env.emailImport.enabled) {
    throw new Error("Email import is disabled. Set EMAIL_IMPORT_ENABLED=true to run the importer.");
  }

  if (!env.emailImport.host || !env.emailImport.user || !env.emailImport.password) {
    throw new Error("Email import credentials are incomplete. Check EMAIL_IMPORT_* settings.");
  }

  const client = buildEmailClient();
  const actorUserId = options.actorUserId || null;
  const importedUidsToMarkSeen = [];
  const summary = {
    mailbox: env.emailImport.mailbox,
    processedMessages: 0,
    importedMessages: 0,
    skippedMessages: 0,
    duplicateMessages: 0,
    failedMessages: 0,
    createdInvoiceIds: []
  };

  await client.connect();

  try {
    const lock = await client.getMailboxLock(env.emailImport.mailbox);

    try {
      const messages = await fetchCandidateMessages(client);

      for (const message of messages) {
        summary.processedMessages += 1;

        try {
          const invoiceMessage = await parseCandidateMessage(message);
          const connection = await pool.getConnection();

          try {
            await connection.beginTransaction();

            const result = await importSingleMessage(connection, invoiceMessage, actorUserId);

            await connection.commit();

            if (result.status === "duplicate") {
              summary.duplicateMessages += 1;
              importedUidsToMarkSeen.push(message.uid);
            } else if (result.status === "skipped") {
              summary.skippedMessages += 1;
              importedUidsToMarkSeen.push(message.uid);
            } else {
              summary.importedMessages += 1;
              importedUidsToMarkSeen.push(message.uid);
            }

            summary.createdInvoiceIds.push(...result.createdInvoiceIds);
          } catch (error) {
            await connection.rollback();
            await removeImportArtifacts(invoiceMessage).catch(() => {});
            summary.failedMessages += 1;
            console.error(`Email import failed for UID ${message.uid}:`, error.message);
          } finally {
            connection.release();
          }
        } catch (error) {
          summary.failedMessages += 1;
          console.error(`Email parsing failed for UID ${message.uid}:`, error.message);
        }
      }

      if (env.emailImport.markSeenOnSuccess && importedUidsToMarkSeen.length > 0) {
        await client.messageFlagsAdd(importedUidsToMarkSeen, ["\\Seen"], { uid: true });
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }

  return summary;
}

module.exports = {
  importInvoicesFromEmailInbox
};
