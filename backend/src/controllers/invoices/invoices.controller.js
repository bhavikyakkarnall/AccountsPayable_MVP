const asyncHandler = require("../../utils/asyncHandler");
const ApiError = require("../../utils/ApiError");
const approvalsModel = require("../../models/approvals/approvals.model");
const invoicesModel = require("../../models/invoices/invoices.model");
const {
  parseInvoiceFilters,
  validateCommentPayload,
  validateInvoicePayload
} = require("./invoices.validation");

function handleInvoiceWriteError(error) {
  if (error.code === "ER_DUP_ENTRY") {
    throw new ApiError(
      409,
      "An invoice with this supplier and invoice number already exists."
    );
  }

  throw error;
}

async function attachApproval(invoice, viewer) {
  return {
    ...invoice,
    approval: await approvalsModel.buildInvoiceApproval(invoice.invoiceId, viewer)
  };
}

const listInvoices = asyncHandler(async (req, res) => {
  const filters = parseInvoiceFilters(req.query);
  const invoices = await invoicesModel.listInvoices(filters);

  res.status(200).json({
    success: true,
    data: invoices
  });
});

const getInvoiceMeta = asyncHandler(async (req, res) => {
  const meta = await invoicesModel.getInvoiceMeta();

  res.status(200).json({
    success: true,
    data: meta
  });
});

const getInvoiceById = asyncHandler(async (req, res) => {
  const invoiceId = Number(req.params.invoiceId);

  if (!Number.isInteger(invoiceId) || invoiceId <= 0) {
    throw new ApiError(400, "Invoice id must be a positive integer.");
  }

  const invoice = await invoicesModel.buildInvoiceDetail(invoiceId);

  if (!invoice) {
    throw new ApiError(404, "Invoice not found.");
  }

  res.status(200).json({
    success: true,
    data: await attachApproval(invoice, req.user)
  });
});

const createInvoice = asyncHandler(async (req, res) => {
  try {
    const payload = validateInvoicePayload(req.body);
    const invoice = await invoicesModel.createInvoice(payload, req.user.userId);

    res.status(201).json({
      success: true,
      message: "Invoice created successfully.",
      data: await attachApproval(invoice, req.user)
    });
  } catch (error) {
    handleInvoiceWriteError(error);
  }
});

const updateInvoice = asyncHandler(async (req, res) => {
  const invoiceId = Number(req.params.invoiceId);

  if (!Number.isInteger(invoiceId) || invoiceId <= 0) {
    throw new ApiError(400, "Invoice id must be a positive integer.");
  }

  try {
    const payload = validateInvoicePayload(req.body, { partial: true });
    const invoice = await invoicesModel.updateInvoice(invoiceId, req.body.statusChangeReason ? {
      ...payload,
      statusChangeReason: req.body.statusChangeReason
    } : payload, req.user.userId);

    res.status(200).json({
      success: true,
      message: "Invoice updated successfully.",
      data: await attachApproval(invoice, req.user)
    });
  } catch (error) {
    handleInvoiceWriteError(error);
  }
});

const deleteInvoice = asyncHandler(async (req, res) => {
  const invoiceId = Number(req.params.invoiceId);

  if (!Number.isInteger(invoiceId) || invoiceId <= 0) {
    throw new ApiError(400, "Invoice id must be a positive integer.");
  }

  const deleted = await invoicesModel.deleteInvoice(invoiceId);

  if (!deleted) {
    throw new ApiError(404, "Invoice not found.");
  }

  res.status(200).json({
    success: true,
    message: "Invoice deleted successfully."
  });
});

const createComment = asyncHandler(async (req, res) => {
  const invoiceId = Number(req.params.invoiceId);

  if (!Number.isInteger(invoiceId) || invoiceId <= 0) {
    throw new ApiError(400, "Invoice id must be a positive integer.");
  }

  const payload = validateCommentPayload(req.body);
  const comment = await invoicesModel.createComment(invoiceId, payload, req.user.userId);

  res.status(201).json({
    success: true,
    message: "Comment added successfully.",
    data: comment
  });
});

module.exports = {
  createComment,
  createInvoice,
  deleteInvoice,
  getInvoiceById,
  getInvoiceMeta,
  listInvoices,
  updateInvoice
};
