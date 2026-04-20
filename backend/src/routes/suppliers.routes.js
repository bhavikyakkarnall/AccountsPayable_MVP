const express = require("express");

const suppliersController = require("../controllers/suppliers/suppliers.controller");
const { APP_ROLES } = require("../constants/roles");
const authorizeRoles = require("../middleware/authorizeRoles");
const requireAuth = require("../middleware/requireAuth");

const router = express.Router();

router.use(requireAuth);

router.get(
  "/",
  authorizeRoles(APP_ROLES.AP_ADMIN, APP_ROLES.AP_PROCESSOR, APP_ROLES.FINANCE_MANAGER),
  suppliersController.listSuppliers
);
router.get(
  "/:supplierId",
  authorizeRoles(APP_ROLES.AP_ADMIN, APP_ROLES.AP_PROCESSOR, APP_ROLES.FINANCE_MANAGER),
  suppliersController.getSupplierById
);
router.post(
  "/",
  authorizeRoles(APP_ROLES.AP_ADMIN, APP_ROLES.FINANCE_MANAGER),
  suppliersController.createSupplier
);
router.put(
  "/:supplierId",
  authorizeRoles(APP_ROLES.AP_ADMIN, APP_ROLES.FINANCE_MANAGER),
  suppliersController.updateSupplier
);

module.exports = router;
