const { pool } = require("../../config/database");

async function listSuppliers() {
  const [rows] = await pool.query(
    `
      SELECT
        supplier_id AS supplierId,
        supplier_name AS supplierName,
        supplier_code AS supplierCode,
        default_currency AS defaultCurrency,
        is_active AS isActive,
        created_at AS createdAt
      FROM suppliers
      ORDER BY supplier_name ASC
    `
  );

  return rows;
}

module.exports = {
  listSuppliers
};
