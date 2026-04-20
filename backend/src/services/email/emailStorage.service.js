const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");

const { env } = require("../../config/env");

function sanitizePathSegment(value) {
  return String(value || "unknown")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "unknown";
}

function buildImportDirectory(invoiceMessage) {
  const receivedAt = invoiceMessage.receivedAt || new Date();
  const year = String(receivedAt.getUTCFullYear());
  const month = String(receivedAt.getUTCMonth() + 1).padStart(2, "0");
  const sender = sanitizePathSegment(invoiceMessage.senderEmail);
  const messageId = sanitizePathSegment(invoiceMessage.messageId);

  return path.join(env.storage.invoiceImportRoot, year, month, `${sender}-${messageId}`);
}

async function ensureDirectory(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

async function saveRawEmail(invoiceMessage) {
  const importDir = buildImportDirectory(invoiceMessage);
  const fileName = "original-message.eml";
  const storagePath = path.join(importDir, fileName);

  await ensureDirectory(importDir);
  await fs.writeFile(storagePath, invoiceMessage.rawSource);

  return {
    storagePath,
    fileName
  };
}

async function saveAttachment(invoiceMessage, attachment, index) {
  const importDir = buildImportDirectory(invoiceMessage);
  const originalName = attachment.filename || `attachment-${index + 1}`;
  const extension = path.extname(originalName).toLowerCase();
  const fileStem = path.basename(originalName, extension);
  const baseName = sanitizePathSegment(fileStem || `attachment-${index + 1}`);
  const storedFileName = `${String(index + 1).padStart(2, "0")}-${baseName || "attachment"}${extension}`;
  const storagePath = path.join(importDir, storedFileName);

  await ensureDirectory(importDir);
  await fs.writeFile(storagePath, attachment.content);

  return {
    fileName: storedFileName,
    originalFileName: attachment.filename || storedFileName,
    mimeType: attachment.contentType || "application/octet-stream",
    fileSizeBytes: attachment.size || attachment.content.length,
    fileChecksumSha256: sha256(attachment.content),
    storageProvider: env.storage.provider,
    storagePath,
    uploadedAt: new Date()
  };
}

async function removeImportArtifacts(invoiceMessage) {
  const importDir = buildImportDirectory(invoiceMessage);
  await fs.rm(importDir, { recursive: true, force: true });
}

module.exports = {
  removeImportArtifacts,
  saveAttachment,
  saveRawEmail
};
