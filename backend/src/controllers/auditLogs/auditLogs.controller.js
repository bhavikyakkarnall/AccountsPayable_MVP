const asyncHandler = require("../../utils/asyncHandler");
const ApiError = require("../../utils/ApiError");
const auditLogsModel = require("../../models/auditLogs/auditLogs.model");

const listAuditLogs = asyncHandler(async (req, res) => {
  const invoiceId =
    req.query.invoiceId === undefined ? undefined : Number(req.query.invoiceId);

  if (invoiceId !== undefined && (!Number.isInteger(invoiceId) || invoiceId <= 0)) {
    throw new ApiError(400, "Invoice id must be a positive integer.");
  }

  const limit = req.query.limit === undefined ? undefined : Number(req.query.limit);
  const events = await auditLogsModel.listAuditEvents({ invoiceId, limit });

  res.status(200).json({
    success: true,
    data: events
  });
});

const getAuditLogById = asyncHandler(async (req, res) => {
  res.status(200).json({
    success: true,
    message: `Placeholder to fetch audit log ${req.params.auditLogId}.`
  });
});

module.exports = {
  listAuditLogs,
  getAuditLogById
};
