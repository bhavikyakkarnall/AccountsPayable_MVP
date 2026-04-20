USE accounts_payable_app;

CREATE TABLE IF NOT EXISTS invoice_audit_logs (
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

CREATE INDEX idx_invoice_audit_logs_invoice_id
    ON invoice_audit_logs (invoice_id);

CREATE INDEX idx_invoice_audit_logs_created_at
    ON invoice_audit_logs (created_at);

CREATE INDEX idx_invoice_audit_logs_event_type
    ON invoice_audit_logs (event_type);
