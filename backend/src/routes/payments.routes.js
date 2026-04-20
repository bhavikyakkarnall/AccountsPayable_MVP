const express = require("express");

const paymentsController = require("../controllers/payments/payments.controller");
const { APP_ROLES } = require("../constants/roles");
const authorizeRoles = require("../middleware/authorizeRoles");
const requireAuth = require("../middleware/requireAuth");

const router = express.Router();

router.use(requireAuth);

router.get(
  "/meta",
  authorizeRoles(APP_ROLES.AP_ADMIN, APP_ROLES.FINANCE_MANAGER),
  paymentsController.getPaymentMeta
);
router.get(
  "/",
  authorizeRoles(APP_ROLES.AP_ADMIN, APP_ROLES.FINANCE_MANAGER),
  paymentsController.listPayments
);
router.get(
  "/:paymentId",
  authorizeRoles(APP_ROLES.AP_ADMIN, APP_ROLES.FINANCE_MANAGER),
  paymentsController.getPaymentById
);
router.post(
  "/",
  authorizeRoles(APP_ROLES.AP_ADMIN, APP_ROLES.FINANCE_MANAGER),
  paymentsController.createPayment
);
router.patch(
  "/:paymentId",
  authorizeRoles(APP_ROLES.AP_ADMIN, APP_ROLES.FINANCE_MANAGER),
  paymentsController.updatePayment
);

module.exports = router;
