# AccountsPayable_MVP
Accounts Payable MVP (Minimum Viable Product) 

## Email Invoice Import

The backend includes a production-oriented email ingestion path for a dedicated AP mailbox.

### Backend structure

- `backend/src/services/email/emailImport.service.js`: connects to IMAP, reads messages, prevents duplicates, and creates invoice imports plus draft invoices
- `backend/src/services/email/emailStorage.service.js`: saves raw `.eml` files and attachments to local storage
- `backend/src/services/email/invoiceExtraction.service.js`: placeholder extraction layer for future OCR/AI work
- `backend/src/models/emailImports/emailImports.model.js`: database writes for email imports and imported invoice records
- `backend/scripts/import-invoices.js`: safe CLI entrypoint for scheduled or manual runs

### Required environment variables

```bash
EMAIL_IMPORT_ENABLED=true
EMAIL_IMPORT_HOST=imap.example.com
EMAIL_IMPORT_PORT=993
EMAIL_IMPORT_SECURE=true
EMAIL_IMPORT_USER=ap-inbox@example.com
EMAIL_IMPORT_PASSWORD=app-password-or-token
EMAIL_IMPORT_MAILBOX=INBOX
EMAIL_IMPORT_MARK_SEEN_ON_SUCCESS=true
EMAIL_IMPORT_INCLUDE_SEEN_MESSAGES=false
EMAIL_IMPORT_MAX_MESSAGES_PER_RUN=25
EMAIL_IMPORT_LOOKBACK_DAYS=14
EMAIL_IMPORT_ALLOWED_EXTENSIONS=.pdf,.png,.jpg,.jpeg,.tif,.tiff,.xml
INVOICE_IMPORT_STORAGE_ROOT=storage/invoice-email-imports
INVOICE_IMPORT_STORAGE_PROVIDER=local
```

### Install and run

```bash
cd backend
npm install
npm run import-invoices:email
```

### Safety notes

- Use a dedicated inbox or mailbox folder for AP imports
- The importer searches unread mail by default and marks messages as seen only after a successful import or safe skip
- Duplicate prevention is enforced through `invoice_email_imports.message_id`
- If a message has no `Message-ID`, the importer falls back to a SHA-256 fingerprint of the raw email
- Attachments are saved before invoice creation, and failed imports clean up their local files
