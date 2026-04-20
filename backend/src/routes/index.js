const express = require("express");

const authRoutes = require("./auth.routes");
const suppliersRoutes = require("./suppliers.routes");
const invoicesRoutes = require("./invoices.routes");
const approvalsRoutes = require("./approvals.routes");
const paymentsRoutes = require("./payments.routes");
const auditLogsRoutes = require("./auditLogs.routes");
const reportsRoutes = require("./reports.routes");

const router = express.Router();

// Feature routes are grouped here so the app entrypoint stays small.
router.use("/auth", authRoutes);
router.use("/suppliers", suppliersRoutes);
router.use("/invoices", invoicesRoutes);
router.use("/approvals", approvalsRoutes);
router.use("/payments", paymentsRoutes);
router.use("/audit-logs", auditLogsRoutes);
router.use("/reports", reportsRoutes);

module.exports = router;
