USE accounts_payable_app;

ALTER TABLE invoices
    MODIFY invoice_number VARCHAR(100) NULL,
    MODIFY invoice_date DATE NULL,
    MODIFY subtotal DECIMAL(18,2) NULL,
    MODIFY tax_amount DECIMAL(18,2) NULL,
    MODIFY total_amount DECIMAL(18,2) NULL,
    ADD COLUMN extraction_status VARCHAR(50) NOT NULL DEFAULT 'not_started' AFTER payment_status,
    ADD COLUMN extraction_confidence VARCHAR(20) NULL AFTER extraction_status;
