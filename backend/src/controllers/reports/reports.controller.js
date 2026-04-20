const asyncHandler = require("../../utils/asyncHandler");
const reportsModel = require("../../models/reports/reports.model");
const { parseReportFilters } = require("./reports.validation");

const getReportMeta = asyncHandler(async (_req, res) => {
  const meta = await reportsModel.getReportMeta();

  res.status(200).json({
    success: true,
    data: meta
  });
});

const getDashboardReport = asyncHandler(async (req, res) => {
  const filters = parseReportFilters(req.query);
  const report = await reportsModel.getDashboardReport(filters);

  res.status(200).json({
    success: true,
    data: report
  });
});

const getOverviewReport = asyncHandler(async (req, res) => {
  const filters = parseReportFilters(req.query);
  const report = await reportsModel.getOverviewReport(filters);

  res.status(200).json({
    success: true,
    data: report
  });
});

module.exports = {
  getDashboardReport,
  getOverviewReport,
  getReportMeta
};
