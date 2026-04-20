const express = require("express");

const approvalsController = require("../controllers/approvals/approvals.controller");
const { APP_ROLES } = require("../constants/roles");
const authorizeRoles = require("../middleware/authorizeRoles");
const requireAuth = require("../middleware/requireAuth");

const router = express.Router();

router.use(requireAuth);

router.get(
  "/workflows",
  authorizeRoles(APP_ROLES.AP_ADMIN, APP_ROLES.FINANCE_MANAGER),
  approvalsController.listApprovalWorkflows
);
router.post(
  "/invoices/:invoiceId/submit",
  authorizeRoles(APP_ROLES.AP_ADMIN, APP_ROLES.AP_PROCESSOR),
  approvalsController.submitInvoiceForApproval
);
router.get(
  "/queue",
  requireAuth,
  approvalsController.getApprovalQueue
);
router.post(
  "/invoices/:invoiceId/decision",
  requireAuth,
  approvalsController.submitApprovalDecision
);

module.exports = router;
