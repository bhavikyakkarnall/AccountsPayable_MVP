const express = require("express");

const auditLogsController = require("../controllers/auditLogs/auditLogs.controller");
const { APP_ROLES } = require("../constants/roles");
const authorizeRoles = require("../middleware/authorizeRoles");
const requireAuth = require("../middleware/requireAuth");

const router = express.Router();

router.use(requireAuth);
router.use(authorizeRoles(APP_ROLES.AP_ADMIN, APP_ROLES.AUDITOR));

router.get("/", auditLogsController.listAuditLogs);
router.get("/:auditLogId", auditLogsController.getAuditLogById);

module.exports = router;
