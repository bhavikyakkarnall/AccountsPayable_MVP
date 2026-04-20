const dotenv = require("dotenv");

dotenv.config();

function getNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getBoolean(value, fallback) {
  if (value === undefined) {
    return fallback;
  }

  return String(value).toLowerCase() === "true";
}

const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: getNumber(process.env.PORT, 4000),
  appOrigin: process.env.APP_ORIGIN || "http://localhost:3000",
  apiPrefix: process.env.API_PREFIX || "/api/v1",
  db: {
    host: process.env.DB_HOST || "127.0.0.1",
    port: getNumber(process.env.DB_PORT, 3306),
    name: process.env.DB_NAME || "accounts_payable_app",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    connectionLimit: getNumber(process.env.DB_CONNECTION_LIMIT, 10)
  },
  session: {
    secret: process.env.SESSION_SECRET || "change-me",
    name: process.env.SESSION_NAME || "ap.sid",
    resave: getBoolean(process.env.SESSION_RESAVE, false),
    saveUninitialized: getBoolean(process.env.SESSION_SAVE_UNINITIALIZED, false),
    cookieSecure: getBoolean(process.env.SESSION_COOKIE_SECURE, false),
    cookieHttpOnly: getBoolean(process.env.SESSION_COOKIE_HTTP_ONLY, true),
    cookieSameSite: process.env.SESSION_COOKIE_SAME_SITE || "lax",
    cookieMaxAgeMs: getNumber(process.env.SESSION_COOKIE_MAX_AGE_MS, 86_400_000),
    store: process.env.SESSION_STORE || "mysql"
  },
  emailImport: {
    enabled: getBoolean(process.env.EMAIL_IMPORT_ENABLED, false),
    host: process.env.EMAIL_IMPORT_HOST || "",
    port: getNumber(process.env.EMAIL_IMPORT_PORT, 993),
    secure: getBoolean(process.env.EMAIL_IMPORT_SECURE, true),
    user: process.env.EMAIL_IMPORT_USER || "",
    password: process.env.EMAIL_IMPORT_PASSWORD || "",
    mailbox: process.env.EMAIL_IMPORT_MAILBOX || "INBOX",
    markSeenOnSuccess: getBoolean(process.env.EMAIL_IMPORT_MARK_SEEN_ON_SUCCESS, true),
    includeSeenMessages: getBoolean(process.env.EMAIL_IMPORT_INCLUDE_SEEN_MESSAGES, false),
    maxMessagesPerRun: getNumber(process.env.EMAIL_IMPORT_MAX_MESSAGES_PER_RUN, 25),
    lookbackDays: getNumber(process.env.EMAIL_IMPORT_LOOKBACK_DAYS, 14),
    allowedExtensions: (process.env.EMAIL_IMPORT_ALLOWED_EXTENSIONS ||
      ".pdf,.png,.jpg,.jpeg,.tif,.tiff,.xml")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean)
  },
  storage: {
    invoiceImportRoot:
      process.env.INVOICE_IMPORT_STORAGE_ROOT || "storage/invoice-email-imports",
    provider: process.env.INVOICE_IMPORT_STORAGE_PROVIDER || "local"
  }
};

module.exports = { env };
