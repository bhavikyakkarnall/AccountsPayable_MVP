const asyncHandler = require("../../utils/asyncHandler");
const ApiError = require("../../utils/ApiError");
const approvalsModel = require("../../models/approvals/approvals.model");
const invoicesModel = require("../../models/invoices/invoices.model");

function parseInvoiceId(value) {
  const invoiceId = Number(value);

  if (!Number.isInteger(invoiceId) || invoiceId <= 0) {
    throw new ApiError(400, "Invoice id must be a positive integer.");
  }

  return invoiceId;
}

function parseActionNotes(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new ApiError(400, "Approval notes must be a string.");
  }

  const trimmedValue = value.trim();

  if (trimmedValue.length > 5000) {
    throw new ApiError(400, "Approval notes must be 5000 characters or fewer.");
  }

  return trimmedValue || null;
}

function parseDecisionAction(value) {
  const action = typeof value === "string" ? value.trim().toLowerCase() : "";

  if (!Object.values(approvalsModel.APPROVAL_ACTIONS).includes(action) || action === "submitted") {
    throw new ApiError(400, "Action must be one of: approve, reject, send_back.");
  }

  return action;
}

async function buildInvoiceResponse(invoiceId, viewer) {
  const invoice = await invoicesModel.buildInvoiceDetail(invoiceId);

  if (!invoice) {
    throw new ApiError(404, "Invoice not found.");
  }

  return {
    ...invoice,
    approval: await approvalsModel.buildInvoiceApproval(invoiceId, viewer)
  };
}

const listApprovalWorkflows = asyncHandler(async (req, res) => {
  const workflows = await approvalsModel.listApprovalWorkflows();

  res.status(200).json({
    success: true,
    data: workflows
  });
});

const submitInvoiceForApproval = asyncHandler(async (req, res) => {
  const invoiceId = parseInvoiceId(req.params.invoiceId);
  await approvalsModel.submitInvoiceForApproval(invoiceId, req.user.userId);
  const invoice = await buildInvoiceResponse(invoiceId, req.user);

  res.status(200).json({
    success: true,
    message: "Invoice submitted for approval.",
    data: invoice
  });
});

const submitApprovalDecision = asyncHandler(async (req, res) => {
  const invoiceId = parseInvoiceId(req.params.invoiceId);
  const actionType = parseDecisionAction(req.body.actionType);
  const actionNotes = parseActionNotes(req.body.actionNotes);

  await approvalsModel.submitApprovalDecision(
    invoiceId,
    actionType,
    actionNotes,
    req.user.userId,
    req.user.roles || []
  );
  const invoice = await buildInvoiceResponse(invoiceId, req.user);

  res.status(200).json({
    success: true,
    message: "Approval decision recorded.",
    data: invoice
  });
});

const getApprovalQueue = asyncHandler(async (req, res) => {
  const queue = await approvalsModel.getApprovalQueue(req.user);

  res.status(200).json({
    success: true,
    data: queue
  });
});

module.exports = {
  listApprovalWorkflows,
  submitInvoiceForApproval,
  submitApprovalDecision,
  getApprovalQueue
};
