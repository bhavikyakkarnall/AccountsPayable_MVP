const asyncHandler = require("../../utils/asyncHandler");
const suppliersModel = require("../../models/suppliers/suppliers.model");

const listSuppliers = asyncHandler(async (req, res) => {
  const suppliers = await suppliersModel.listSuppliers();

  res.status(200).json({
    success: true,
    data: suppliers
  });
});

const getSupplierById = asyncHandler(async (req, res) => {
  res.status(200).json({
    success: true,
    message: `Placeholder to fetch supplier ${req.params.supplierId}.`
  });
});

const createSupplier = asyncHandler(async (req, res) => {
  res.status(201).json({
    success: true,
    message: "Placeholder to create a supplier.",
    data: req.body
  });
});

const updateSupplier = asyncHandler(async (req, res) => {
  res.status(200).json({
    success: true,
    message: `Placeholder to update supplier ${req.params.supplierId}.`,
    data: req.body
  });
});

module.exports = {
  listSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier
};
