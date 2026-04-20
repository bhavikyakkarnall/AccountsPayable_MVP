const asyncHandler = require("../../utils/asyncHandler");
const ApiError = require("../../utils/ApiError");
const paymentsModel = require("../../models/payments/payments.model");
const {
  parsePaymentFilters,
  validatePaymentPayload
} = require("./payments.validation");

function handlePaymentWriteError(error) {
  if (error.code === "ER_DUP_ENTRY") {
    throw new ApiError(409, "Payment reference already exists.");
  }

  throw error;
}

const listPayments = asyncHandler(async (req, res) => {
  const payments = await paymentsModel.listPayments(parsePaymentFilters(req.query));

  res.status(200).json({
    success: true,
    data: payments
  });
});

const getPaymentMeta = asyncHandler(async (req, res) => {
  const payableInvoices = await paymentsModel.listPayableInvoices();

  res.status(200).json({
    success: true,
    data: {
      payableInvoices
    }
  });
});

const createPayment = asyncHandler(async (req, res) => {
  try {
    const payload = validatePaymentPayload(
      {
        paymentStatus: "ready_for_payment",
        ...req.body
      },
      { partial: false }
    );

    const payment = await paymentsModel.createPayment(payload, req.user.userId);

    res.status(201).json({
      success: true,
      message: "Payment created successfully.",
      data: payment
    });
  } catch (error) {
    handlePaymentWriteError(error);
  }
});

const getPaymentById = asyncHandler(async (req, res) => {
  const paymentId = Number(req.params.paymentId);

  if (!Number.isInteger(paymentId) || paymentId <= 0) {
    throw new ApiError(400, "Payment id must be a positive integer.");
  }

  const payment = await paymentsModel.getPaymentById(paymentId);

  if (!payment) {
    throw new ApiError(404, "Payment not found.");
  }

  res.status(200).json({
    success: true,
    data: payment
  });
});

const updatePayment = asyncHandler(async (req, res) => {
  const paymentId = Number(req.params.paymentId);

  if (!Number.isInteger(paymentId) || paymentId <= 0) {
    throw new ApiError(400, "Payment id must be a positive integer.");
  }

  try {
    const payload = validatePaymentPayload(req.body, { partial: true });
    const payment = await paymentsModel.updatePayment(paymentId, payload, req.user.userId);

    res.status(200).json({
      success: true,
      message: "Payment updated successfully.",
      data: payment
    });
  } catch (error) {
    handlePaymentWriteError(error);
  }
});

module.exports = {
  listPayments,
  getPaymentMeta,
  createPayment,
  getPaymentById,
  updatePayment
};
