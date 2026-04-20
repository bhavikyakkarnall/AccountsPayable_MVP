-- Accounts Payable MVP MySQL schema
-- Target: MySQL 8.0+

CREATE DATABASE IF NOT EXISTS accounts_payable_app
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE accounts_payable_app;

CREATE TABLE users (
    user_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    job_title VARCHAR(150) NULL,
    department VARCHAR(150) NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    last_login_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by_user_id BIGINT UNSIGNED NULL,
    updated_by_user_id BIGINT UNSIGNED NULL,
    PRIMARY KEY (user_id),
    UNIQUE KEY uq_users_email (email),
    CONSTRAINT fk_users_created_by
        FOREIGN KEY (created_by_user_id) REFERENCES users (user_id),
    CONSTRAINT fk_users_updated_by
        FOREIGN KEY (updated_by_user_id) REFERENCES users (user_id)
) ENGINE=InnoDB;

CREATE TABLE roles (
    role_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    role_name VARCHAR(100) NOT NULL,
    role_code VARCHAR(50) NOT NULL,
    description VARCHAR(255) NULL,
    is_system_role TINYINT(1) NOT NULL DEFAULT 0,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by_user_id BIGINT UNSIGNED NULL,
    updated_by_user_id BIGINT UNSIGNED NULL,
    PRIMARY KEY (role_id),
    UNIQUE KEY uq_roles_role_name (role_name),
    UNIQUE KEY uq_roles_role_code (role_code),
    CONSTRAINT fk_roles_created_by
        FOREIGN KEY (created_by_user_id) REFERENCES users (user_id),
    CONSTRAINT fk_roles_updated_by
        FOREIGN KEY (updated_by_user_id) REFERENCES users (user_id)
) ENGINE=InnoDB;

CREATE TABLE user_roles (
    user_role_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id BIGINT UNSIGNED NOT NULL,
    role_id BIGINT UNSIGNED NOT NULL,
    assigned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    assigned_by_user_id BIGINT UNSIGNED NULL,
    expires_at DATETIME NULL,
    PRIMARY KEY (user_role_id),
    UNIQUE KEY uq_user_roles_user_role (user_id, role_id),
    CONSTRAINT fk_user_roles_user
        FOREIGN KEY (user_id) REFERENCES users (user_id),
    CONSTRAINT fk_user_roles_role
        FOREIGN KEY (role_id) REFERENCES roles (role_id),
    CONSTRAINT fk_user_roles_assigned_by
        FOREIGN KEY (assigned_by_user_id) REFERENCES users (user_id)
) ENGINE=InnoDB;

CREATE TABLE suppliers (
    supplier_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    supplier_name VARCHAR(255) NOT NULL,
    supplier_code VARCHAR(100) NULL,
    tax_id VARCHAR(100) NULL,
    contact_name VARCHAR(150) NULL,
    contact_email VARCHAR(255) NULL,
    contact_phone VARCHAR(50) NULL,
    address_line_1 VARCHAR(255) NULL,
    address_line_2 VARCHAR(255) NULL,
    city VARCHAR(100) NULL,
    state_region VARCHAR(100) NULL,
    postal_code VARCHAR(30) NULL,
    country_code CHAR(2) NULL,
    payment_terms_days INT UNSIGNED NOT NULL DEFAULT 30,
    default_currency CHAR(3) NOT NULL DEFAULT 'USD',
    external_supplier_ref VARCHAR(100) NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by_user_id BIGINT UNSIGNED NULL,
    updated_by_user_id BIGINT UNSIGNED NULL,
    PRIMARY KEY (supplier_id),
    UNIQUE KEY uq_suppliers_supplier_code (supplier_code),
    UNIQUE KEY uq_suppliers_external_supplier_ref (external_supplier_ref),
    CONSTRAINT fk_suppliers_created_by
        FOREIGN KEY (created_by_user_id) REFERENCES users (user_id),
    CONSTRAINT fk_suppliers_updated_by
        FOREIGN KEY (updated_by_user_id) REFERENCES users (user_id)
) ENGINE=InnoDB;

CREATE TABLE invoice_email_imports (
    invoice_email_import_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    mailbox_name VARCHAR(150) NOT NULL,
    message_id VARCHAR(255) NOT NULL,
    thread_id VARCHAR(255) NULL,
    sender_email VARCHAR(255) NOT NULL,
    sender_name VARCHAR(255) NULL,
    recipient_email VARCHAR(255) NULL,
    subject VARCHAR(500) NULL,
    received_at DATETIME NOT NULL,
    imported_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    processing_status VARCHAR(50) NOT NULL DEFAULT 'pending',
    processing_notes TEXT NULL,
    attachment_count INT UNSIGNED NOT NULL DEFAULT 0,
    raw_email_storage_path VARCHAR(500) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by_user_id BIGINT UNSIGNED NULL,
    updated_by_user_id BIGINT UNSIGNED NULL,
    PRIMARY KEY (invoice_email_import_id),
    UNIQUE KEY uq_invoice_email_imports_message_id (message_id),
    CONSTRAINT fk_invoice_email_imports_created_by
        FOREIGN KEY (created_by_user_id) REFERENCES users (user_id),
    CONSTRAINT fk_invoice_email_imports_updated_by
        FOREIGN KEY (updated_by_user_id) REFERENCES users (user_id)
) ENGINE=InnoDB;

CREATE TABLE approval_workflows (
    approval_workflow_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    workflow_name VARCHAR(150) NOT NULL,
    workflow_code VARCHAR(50) NOT NULL,
    description VARCHAR(255) NULL,
    supplier_id BIGINT UNSIGNED NULL,
    currency CHAR(3) NULL,
    min_invoice_amount DECIMAL(18,2) NULL,
    max_invoice_amount DECIMAL(18,2) NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    effective_from DATE NULL,
    effective_to DATE NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by_user_id BIGINT UNSIGNED NULL,
    updated_by_user_id BIGINT UNSIGNED NULL,
    PRIMARY KEY (approval_workflow_id),
    UNIQUE KEY uq_approval_workflows_code (workflow_code),
    CONSTRAINT fk_approval_workflows_supplier
        FOREIGN KEY (supplier_id) REFERENCES suppliers (supplier_id),
    CONSTRAINT fk_approval_workflows_created_by
        FOREIGN KEY (created_by_user_id) REFERENCES users (user_id),
    CONSTRAINT fk_approval_workflows_updated_by
        FOREIGN KEY (updated_by_user_id) REFERENCES users (user_id)
) ENGINE=InnoDB;

CREATE TABLE approval_steps (
    approval_step_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    approval_workflow_id BIGINT UNSIGNED NOT NULL,
    step_order INT UNSIGNED NOT NULL,
    step_name VARCHAR(150) NOT NULL,
    approver_role_id BIGINT UNSIGNED NULL,
    approver_user_id BIGINT UNSIGNED NULL,
    min_approvals_required INT UNSIGNED NOT NULL DEFAULT 1,
    allow_delegation TINYINT(1) NOT NULL DEFAULT 0,
    due_in_hours INT UNSIGNED NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by_user_id BIGINT UNSIGNED NULL,
    updated_by_user_id BIGINT UNSIGNED NULL,
    PRIMARY KEY (approval_step_id),
    UNIQUE KEY uq_approval_steps_workflow_order (approval_workflow_id, step_order),
    CONSTRAINT fk_approval_steps_workflow
        FOREIGN KEY (approval_workflow_id) REFERENCES approval_workflows (approval_workflow_id),
    CONSTRAINT fk_approval_steps_role
        FOREIGN KEY (approver_role_id) REFERENCES roles (role_id),
    CONSTRAINT fk_approval_steps_user
        FOREIGN KEY (approver_user_id) REFERENCES users (user_id),
    CONSTRAINT fk_approval_steps_created_by
        FOREIGN KEY (created_by_user_id) REFERENCES users (user_id),
    CONSTRAINT fk_approval_steps_updated_by
        FOREIGN KEY (updated_by_user_id) REFERENCES users (user_id)
) ENGINE=InnoDB;

CREATE TABLE invoices (
    invoice_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    supplier_id BIGINT UNSIGNED NOT NULL,
    invoice_number VARCHAR(100) NULL,
    invoice_date DATE NULL,
    due_date DATE NULL,
    subtotal DECIMAL(18,2) NULL,
    tax_amount DECIMAL(18,2) NULL,
    total_amount DECIMAL(18,2) NULL,
    currency CHAR(3) NOT NULL,
    external_po_number VARCHAR(100) NULL,
    external_po_verified TINYINT(1) NOT NULL DEFAULT 0,
    external_po_verified_at DATETIME NULL,
    verification_notes TEXT NULL,
    assigned_to BIGINT UNSIGNED NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'draft',
    source_email_id BIGINT UNSIGNED NULL,
    approval_workflow_id BIGINT UNSIGNED NULL,
    current_approval_round INT UNSIGNED NOT NULL DEFAULT 0,
    duplicate_flag TINYINT(1) NOT NULL DEFAULT 0,
    hold_reason VARCHAR(255) NULL,
    payment_status VARCHAR(50) NOT NULL DEFAULT 'unpaid',
    extraction_status VARCHAR(50) NOT NULL DEFAULT 'not_started',
    extraction_confidence VARCHAR(20) NULL,
    extracted_data_json JSON NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by_user_id BIGINT UNSIGNED NULL,
    updated_by_user_id BIGINT UNSIGNED NULL,
    PRIMARY KEY (invoice_id),
    UNIQUE KEY uq_invoices_supplier_invoice_number (supplier_id, invoice_number),
    CONSTRAINT fk_invoices_supplier
        FOREIGN KEY (supplier_id) REFERENCES suppliers (supplier_id),
    CONSTRAINT fk_invoices_assigned_to
        FOREIGN KEY (assigned_to) REFERENCES users (user_id),
    CONSTRAINT fk_invoices_source_email
        FOREIGN KEY (source_email_id) REFERENCES invoice_email_imports (invoice_email_import_id),
    CONSTRAINT fk_invoices_workflow
        FOREIGN KEY (approval_workflow_id) REFERENCES approval_workflows (approval_workflow_id),
    CONSTRAINT fk_invoices_created_by
        FOREIGN KEY (created_by_user_id) REFERENCES users (user_id),
    CONSTRAINT fk_invoices_updated_by
        FOREIGN KEY (updated_by_user_id) REFERENCES users (user_id)
) ENGINE=InnoDB;

CREATE TABLE invoice_files (
    invoice_file_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    invoice_id BIGINT UNSIGNED NOT NULL,
    invoice_email_import_id BIGINT UNSIGNED NULL,
    file_name VARCHAR(255) NOT NULL,
    original_file_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_size_bytes BIGINT UNSIGNED NOT NULL,
    file_checksum_sha256 CHAR(64) NULL,
    storage_provider VARCHAR(50) NOT NULL DEFAULT 'local',
    storage_path VARCHAR(500) NOT NULL,
    is_primary_document TINYINT(1) NOT NULL DEFAULT 1,
    uploaded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by_user_id BIGINT UNSIGNED NULL,
    updated_by_user_id BIGINT UNSIGNED NULL,
    PRIMARY KEY (invoice_file_id),
    CONSTRAINT fk_invoice_files_invoice
        FOREIGN KEY (invoice_id) REFERENCES invoices (invoice_id),
    CONSTRAINT fk_invoice_files_email_import
        FOREIGN KEY (invoice_email_import_id) REFERENCES invoice_email_imports (invoice_email_import_id),
    CONSTRAINT fk_invoice_files_created_by
        FOREIGN KEY (created_by_user_id) REFERENCES users (user_id),
    CONSTRAINT fk_invoice_files_updated_by
        FOREIGN KEY (updated_by_user_id) REFERENCES users (user_id)
) ENGINE=InnoDB;

CREATE TABLE invoice_items (
    invoice_item_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    invoice_id BIGINT UNSIGNED NOT NULL,
    line_number INT UNSIGNED NOT NULL,
    item_description VARCHAR(500) NOT NULL,
    quantity DECIMAL(18,4) NOT NULL DEFAULT 1.0000,
    unit_price DECIMAL(18,4) NOT NULL DEFAULT 0.0000,
    line_subtotal DECIMAL(18,2) NOT NULL DEFAULT 0.00,
    tax_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
    line_total DECIMAL(18,2) NOT NULL DEFAULT 0.00,
    unit_of_measure VARCHAR(50) NULL,
    external_po_line_number VARCHAR(50) NULL,
    gl_code VARCHAR(50) NULL,
    cost_center VARCHAR(50) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by_user_id BIGINT UNSIGNED NULL,
    updated_by_user_id BIGINT UNSIGNED NULL,
    PRIMARY KEY (invoice_item_id),
    UNIQUE KEY uq_invoice_items_invoice_line_number (invoice_id, line_number),
    CONSTRAINT fk_invoice_items_invoice
        FOREIGN KEY (invoice_id) REFERENCES invoices (invoice_id),
    CONSTRAINT fk_invoice_items_created_by
        FOREIGN KEY (created_by_user_id) REFERENCES users (user_id),
    CONSTRAINT fk_invoice_items_updated_by
        FOREIGN KEY (updated_by_user_id) REFERENCES users (user_id)
) ENGINE=InnoDB;

CREATE TABLE invoice_comments (
    invoice_comment_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    invoice_id BIGINT UNSIGNED NOT NULL,
    comment_text TEXT NOT NULL,
    is_internal TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by_user_id BIGINT UNSIGNED NOT NULL,
    updated_by_user_id BIGINT UNSIGNED NULL,
    PRIMARY KEY (invoice_comment_id),
    CONSTRAINT fk_invoice_comments_invoice
        FOREIGN KEY (invoice_id) REFERENCES invoices (invoice_id),
    CONSTRAINT fk_invoice_comments_created_by
        FOREIGN KEY (created_by_user_id) REFERENCES users (user_id),
    CONSTRAINT fk_invoice_comments_updated_by
        FOREIGN KEY (updated_by_user_id) REFERENCES users (user_id)
) ENGINE=InnoDB;

CREATE TABLE invoice_status_history (
    invoice_status_history_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    invoice_id BIGINT UNSIGNED NOT NULL,
    from_status VARCHAR(50) NULL,
    to_status VARCHAR(50) NOT NULL,
    change_reason VARCHAR(255) NULL,
    changed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    changed_by_user_id BIGINT UNSIGNED NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (invoice_status_history_id),
    CONSTRAINT fk_invoice_status_history_invoice
        FOREIGN KEY (invoice_id) REFERENCES invoices (invoice_id),
    CONSTRAINT fk_invoice_status_history_changed_by
        FOREIGN KEY (changed_by_user_id) REFERENCES users (user_id)
) ENGINE=InnoDB;

CREATE TABLE invoice_audit_logs (
    invoice_audit_log_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    invoice_id BIGINT UNSIGNED NOT NULL,
    actor_user_id BIGINT UNSIGNED NULL,
    event_type VARCHAR(100) NOT NULL,
    action_label VARCHAR(150) NOT NULL,
    target_type VARCHAR(50) NOT NULL DEFAULT 'invoice',
    target_id BIGINT UNSIGNED NULL,
    changed_fields_json JSON NOT NULL,
    metadata_json JSON NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (invoice_audit_log_id),
    CONSTRAINT fk_invoice_audit_logs_invoice
        FOREIGN KEY (invoice_id) REFERENCES invoices (invoice_id),
    CONSTRAINT fk_invoice_audit_logs_actor
        FOREIGN KEY (actor_user_id) REFERENCES users (user_id)
) ENGINE=InnoDB;

CREATE TABLE approval_actions (
    approval_action_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    invoice_id BIGINT UNSIGNED NOT NULL,
    approval_step_id BIGINT UNSIGNED NOT NULL,
    approval_round INT UNSIGNED NOT NULL DEFAULT 1,
    action_by_user_id BIGINT UNSIGNED NOT NULL,
    action_type VARCHAR(50) NOT NULL,
    action_notes TEXT NULL,
    action_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (approval_action_id),
    CONSTRAINT fk_approval_actions_invoice
        FOREIGN KEY (invoice_id) REFERENCES invoices (invoice_id),
    CONSTRAINT fk_approval_actions_step
        FOREIGN KEY (approval_step_id) REFERENCES approval_steps (approval_step_id),
    CONSTRAINT fk_approval_actions_user
        FOREIGN KEY (action_by_user_id) REFERENCES users (user_id)
) ENGINE=InnoDB;

CREATE TABLE payments (
    payment_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    invoice_id BIGINT UNSIGNED NOT NULL,
    payment_reference VARCHAR(100) NULL,
    payment_date DATE NULL,
    amount DECIMAL(18,2) NOT NULL,
    currency CHAR(3) NOT NULL,
    payment_method VARCHAR(50) NULL,
    payment_status VARCHAR(50) NOT NULL DEFAULT 'ready_for_payment',
    external_payment_id VARCHAR(100) NULL,
    bank_reference VARCHAR(100) NULL,
    notes TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by_user_id BIGINT UNSIGNED NULL,
    updated_by_user_id BIGINT UNSIGNED NULL,
    PRIMARY KEY (payment_id),
    UNIQUE KEY uq_payments_payment_reference (payment_reference),
    CONSTRAINT fk_payments_invoice
        FOREIGN KEY (invoice_id) REFERENCES invoices (invoice_id),
    CONSTRAINT fk_payments_created_by
        FOREIGN KEY (created_by_user_id) REFERENCES users (user_id),
    CONSTRAINT fk_payments_updated_by
        FOREIGN KEY (updated_by_user_id) REFERENCES users (user_id)
) ENGINE=InnoDB;

CREATE INDEX idx_user_roles_role_id
    ON user_roles (role_id);

CREATE INDEX idx_suppliers_supplier_name
    ON suppliers (supplier_name);

CREATE INDEX idx_suppliers_contact_email
    ON suppliers (contact_email);

CREATE INDEX idx_invoice_email_imports_received_at
    ON invoice_email_imports (received_at);

CREATE INDEX idx_invoice_email_imports_processing_status
    ON invoice_email_imports (processing_status);

CREATE INDEX idx_approval_workflows_supplier_id
    ON approval_workflows (supplier_id);

CREATE INDEX idx_approval_workflows_active
    ON approval_workflows (is_active, effective_from, effective_to);

CREATE INDEX idx_approval_steps_role_id
    ON approval_steps (approver_role_id);

CREATE INDEX idx_approval_steps_user_id
    ON approval_steps (approver_user_id);

CREATE INDEX idx_invoices_status
    ON invoices (status);

CREATE INDEX idx_invoices_due_date
    ON invoices (due_date);

CREATE INDEX idx_invoices_assigned_to
    ON invoices (assigned_to);

CREATE INDEX idx_invoices_source_email_id
    ON invoices (source_email_id);

CREATE INDEX idx_invoices_external_po_number
    ON invoices (external_po_number);

CREATE INDEX idx_invoices_duplicate_flag
    ON invoices (duplicate_flag);

CREATE INDEX idx_invoices_supplier_status_due_date
    ON invoices (supplier_id, status, due_date);

CREATE INDEX idx_invoice_files_invoice_id
    ON invoice_files (invoice_id);

CREATE INDEX idx_invoice_files_email_import_id
    ON invoice_files (invoice_email_import_id);

CREATE INDEX idx_invoice_items_invoice_id
    ON invoice_items (invoice_id);

CREATE INDEX idx_invoice_comments_invoice_id
    ON invoice_comments (invoice_id);

CREATE INDEX idx_invoice_status_history_invoice_id
    ON invoice_status_history (invoice_id);

CREATE INDEX idx_invoice_status_history_changed_at
    ON invoice_status_history (changed_at);

CREATE INDEX idx_invoice_audit_logs_invoice_id
    ON invoice_audit_logs (invoice_id);

CREATE INDEX idx_invoice_audit_logs_created_at
    ON invoice_audit_logs (created_at);

CREATE INDEX idx_invoice_audit_logs_event_type
    ON invoice_audit_logs (event_type);

CREATE INDEX idx_approval_actions_invoice_id
    ON approval_actions (invoice_id);

CREATE INDEX idx_approval_actions_invoice_round
    ON approval_actions (invoice_id, approval_round);

CREATE INDEX idx_approval_actions_step_id
    ON approval_actions (approval_step_id);

CREATE INDEX idx_approval_actions_user_id
    ON approval_actions (action_by_user_id);

CREATE INDEX idx_payments_invoice_id
    ON payments (invoice_id);

CREATE INDEX idx_payments_payment_date
    ON payments (payment_date);

CREATE INDEX idx_payments_payment_status
    ON payments (payment_status);

INSERT INTO roles (role_name, role_code, description, is_system_role, is_active)
VALUES
    ('AP Admin', 'ap_admin', 'Full administrative control across the accounts payable app.', 1, 1),
    ('AP Processor', 'ap_processor', 'Processes suppliers and invoices before approval.', 1, 1),
    ('Approver', 'approver', 'Reviews and approves invoices in assigned approval queues.', 1, 1),
    ('Finance Manager', 'finance_manager', 'Oversees payment execution and finance reporting.', 1, 1),
    ('Auditor', 'auditor', 'Read-only access for audit and reporting review.', 1, 1)
ON DUPLICATE KEY UPDATE
    role_name = VALUES(role_name),
    description = VALUES(description),
    is_system_role = VALUES(is_system_role),
    is_active = VALUES(is_active);
