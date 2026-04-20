USE accounts_payable_app;

INSERT INTO users (
    first_name,
    last_name,
    email,
    password_hash,
    job_title,
    department,
    is_active
)
VALUES (
    'Demo',
    'Admin',
    'admin@example.com',
    'scrypt$16384$8$1$18172cd1958657e7963be55c02526a59$fd53d5ec6500f1a130c75f358cd9176e81adbde06786d240ad6164bd7ab1f785d458f1f1810f9514da15716ee7d4316f5cf148209044937222bd77145830ad40',
    'AP Administrator',
    'Finance',
    1
)
ON DUPLICATE KEY UPDATE
    first_name = VALUES(first_name),
    last_name = VALUES(last_name),
    password_hash = VALUES(password_hash),
    job_title = VALUES(job_title),
    department = VALUES(department),
    is_active = VALUES(is_active);

INSERT INTO user_roles (
    user_id,
    role_id,
    assigned_by_user_id
)
SELECT
    u.user_id,
    r.role_id,
    NULL
FROM users u
INNER JOIN roles r
    ON r.role_code = 'ap_admin'
WHERE LOWER(u.email) = LOWER('admin@example.com')
ON DUPLICATE KEY UPDATE
    expires_at = NULL;
