const { pool } = require("../../config/database");

async function findUserByEmail(email) {
  const [rows] = await pool.query(
    `
      SELECT
        u.user_id AS userId,
        u.first_name AS firstName,
        u.last_name AS lastName,
        u.email,
        u.password_hash AS passwordHash,
        u.is_active AS isActive
      FROM users u
      WHERE LOWER(u.email) = LOWER(?)
      LIMIT 1
    `,
    [email]
  );

  return rows[0] || null;
}

async function findUserRoles(userId) {
  const [rows] = await pool.query(
    `
      SELECT r.role_code AS roleCode
      FROM user_roles ur
      INNER JOIN roles r ON r.role_id = ur.role_id
      WHERE ur.user_id = ?
        AND r.is_active = 1
        AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
      ORDER BY r.role_code ASC
    `,
    [userId]
  );

  return rows.map((row) => row.roleCode);
}

async function updateLastLoginAt(userId) {
  await pool.query(
    `
      UPDATE users
      SET last_login_at = NOW()
      WHERE user_id = ?
    `,
    [userId]
  );
}

module.exports = {
  findUserByEmail,
  findUserRoles,
  updateLastLoginAt
};
