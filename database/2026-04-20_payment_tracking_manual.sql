USE accounts_payable_app;

ALTER TABLE payments
    MODIFY COLUMN payment_reference VARCHAR(100) NULL,
    MODIFY COLUMN payment_date DATE NULL,
    MODIFY COLUMN payment_method VARCHAR(50) NULL,
    MODIFY COLUMN payment_status VARCHAR(50) NOT NULL DEFAULT 'ready_for_payment';

UPDATE payments
SET payment_status = CASE payment_status
    WHEN 'scheduled' THEN 'ready_for_payment'
    WHEN 'processing' THEN 'payment_submitted'
    WHEN 'failed' THEN 'payment_failed'
    ELSE payment_status
END;

UPDATE invoices
SET payment_status = CASE payment_status
    WHEN 'scheduled' THEN 'ready_for_payment'
    WHEN 'processing' THEN 'payment_submitted'
    WHEN 'failed' THEN 'payment_failed'
    ELSE payment_status
END;
