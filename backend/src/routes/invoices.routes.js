const express = require("express");

const invoicesController = require("../controllers/invoices/invoices.controller");
const { APP_ROLES } = require("../constants/roles");
const authorizeRoles = require("../middleware/authorizeRoles");
const requireAuth = require("../middleware/requireAuth");

const router = express.Router();

router.use(requireAuth);

router.get(
  "/",
  authorizeRoles(
    APP_ROLES.AP_ADMIN,
    APP_ROLES.AP_PROCESSOR,
    APP_ROLES.APPROVER,
    APP_ROLES.FINANCE_MANAGER,
    APP_ROLES.AUDITOR
  ),
  invoicesController.listInvoices
);
router.get(
  "/meta",
  authorizeRoles(
    APP_ROLES.AP_ADMIN,
    APP_ROLES.AP_PROCESSOR,
    APP_ROLES.APPROVER,
    APP_ROLES.FINANCE_MANAGER,
    APP_ROLES.AUDITOR
  ),
  invoicesController.getInvoiceMeta
);
router.get(
  "/:invoiceId",
  authorizeRoles(
    APP_ROLES.AP_ADMIN,
    APP_ROLES.AP_PROCESSOR,
    APP_ROLES.APPROVER,
    APP_ROLES.FINANCE_MANAGER,
    APP_ROLES.AUDITOR
  ),
  invoicesController.getInvoiceById
);
router.post(
  "/",
  authorizeRoles(APP_ROLES.AP_ADMIN, APP_ROLES.AP_PROCESSOR),
  invoicesController.createInvoice
);
router.put(
  "/:invoiceId",
  authorizeRoles(APP_ROLES.AP_ADMIN, APP_ROLES.AP_PROCESSOR),
  invoicesController.updateInvoice
);
router.delete(
  "/:invoiceId",
  authorizeRoles(APP_ROLES.AP_ADMIN, APP_ROLES.AP_PROCESSOR),
  invoicesController.deleteInvoice
);
router.post(
  "/:invoiceId/comments",
  authorizeRoles(
    APP_ROLES.AP_ADMIN,
    APP_ROLES.AP_PROCESSOR,
    APP_ROLES.APPROVER,
    APP_ROLES.FINANCE_MANAGER
  ),
  invoicesController.createComment
);

module.exports = router;
