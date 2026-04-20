const express = require("express");

const reportsController = require("../controllers/reports/reports.controller");
const { APP_ROLES } = require("../constants/roles");
const authorizeRoles = require("../middleware/authorizeRoles");
const requireAuth = require("../middleware/requireAuth");

const router = express.Router();

router.use(requireAuth);

router.get(
  "/meta",
  authorizeRoles(...Object.values(APP_ROLES)),
  reportsController.getReportMeta
);
router.get(
  "/dashboard",
  authorizeRoles(...Object.values(APP_ROLES)),
  reportsController.getDashboardReport
);
router.get(
  "/overview",
  authorizeRoles(APP_ROLES.AP_ADMIN, APP_ROLES.FINANCE_MANAGER, APP_ROLES.AUDITOR),
  reportsController.getOverviewReport
);

module.exports = router;
