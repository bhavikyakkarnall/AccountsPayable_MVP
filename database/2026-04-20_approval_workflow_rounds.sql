USE accounts_payable_app;

ALTER TABLE invoices
    ADD COLUMN current_approval_round INT UNSIGNED NOT NULL DEFAULT 0
    AFTER approval_workflow_id;

ALTER TABLE approval_actions
    ADD COLUMN approval_round INT UNSIGNED NOT NULL DEFAULT 1
    AFTER approval_step_id;

CREATE INDEX idx_approval_actions_invoice_round
    ON approval_actions (invoice_id, approval_round);
