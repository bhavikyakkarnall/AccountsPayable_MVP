import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import { APP_ROLES } from "../config/roles";
import { useAuth } from "../context/AuthContext";
import { APPROVAL_ACTION_LABELS, submitApprovalDecision, submitInvoiceForApproval } from "../lib/approvals";
import {
  createEmptyPaymentForm,
  createPayment,
  getAllowedNextPaymentStatuses,
  PAYMENT_STATUS_LABELS,
  toPaymentForm,
  toPaymentPayload,
  toPaymentUpdatePayload,
  updatePayment
} from "../lib/payments";
import {
  createInvoiceComment,
  deleteInvoice,
  EXTRACTION_CONFIDENCE_LABELS,
  EXTRACTION_STATUS_LABELS,
  fetchInvoiceById,
  fetchInvoiceMeta,
  INVOICE_STATUSES,
  MANUAL_INVOICE_STATUSES,
  STATUS_LABELS,
  toInvoiceForm,
  toInvoicePayload,
  updateInvoice
} from "../lib/invoices";

function formatCurrency(amount, currency) {
  if (amount === null || amount === undefined || Number.isNaN(Number(amount))) {
    return "Not set";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD"
  }).format(Number(amount));
}

function formatDateTime(value) {
  if (!value) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en-NZ", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function canEditInvoiceForRoles(roles) {
  return roles.includes(APP_ROLES.AP_ADMIN) || roles.includes(APP_ROLES.AP_PROCESSOR);
}

function canCommentForRoles(roles) {
  return (
    roles.includes(APP_ROLES.AP_ADMIN) ||
    roles.includes(APP_ROLES.AP_PROCESSOR) ||
    roles.includes(APP_ROLES.APPROVER) ||
    roles.includes(APP_ROLES.FINANCE_MANAGER)
  );
}

function canManagePaymentsForRoles(roles) {
  return roles.includes(APP_ROLES.AP_ADMIN) || roles.includes(APP_ROLES.FINANCE_MANAGER);
}

function emptyAttachment() {
  return {
    fileName: "",
    originalFileName: "",
    mimeType: "application/pdf",
    fileSizeBytes: "",
    fileChecksumSha256: "",
    storageProvider: "local",
    storagePath: "",
    isPrimaryDocument: true,
    uploadedAt: ""
  };
}

const EXTRACTION_FIELDS = [
  { key: "invoiceNumber", label: "Invoice number" },
  { key: "invoiceDate", label: "Invoice date" },
  { key: "dueDate", label: "Due date" },
  { key: "subtotal", label: "Subtotal", type: "currency" },
  { key: "tax", label: "Tax", type: "currency" },
  { key: "total", label: "Total", type: "currency" },
  { key: "currency", label: "Currency" }
];

function toneForExtractionConfidence(confidence) {
  if (confidence === "high") {
    return "success";
  }

  if (confidence === "medium") {
    return "info";
  }

  return "warning";
}

function toneForExtractionStatus(status) {
  if (status === "completed" || status === "reviewed") {
    return "success";
  }

  if (status === "failed") {
    return "danger";
  }

  if (status === "not_started") {
    return "secondary";
  }

  return "warning";
}

function formatExtractedFieldValue(field, invoiceCurrency) {
  if (!field || field.value === null || field.value === undefined || field.value === "") {
    return "Blank";
  }

  if (field.key === "subtotal" || field.key === "tax" || field.key === "total") {
    return formatCurrency(field.value, invoiceCurrency);
  }

  return String(field.value);
}

const AUDIT_EVENT_LABELS = {
  invoice_created: "Invoice created",
  invoice_updated: "Invoice updated",
  status_changed: "Status changed",
  assignment_changed: "Assignment changed",
  verification_changed: "Verification changed",
  approval_action: "Approval action",
  payment_updated: "Payment updated",
  comment_added: "Comment added"
};

function formatAuditValue(field, value, currency = "USD") {
  if (value === null || value === undefined || value === "") {
    return "Blank";
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (field === "status") {
    return STATUS_LABELS[value] || value;
  }

  if (field === "paymentStatus") {
    return PAYMENT_STATUS_LABELS[value] || value;
  }

  if (field === "subtotal" || field === "tax" || field === "total" || field === "amount") {
    return formatCurrency(value, currency);
  }

  if (Array.isArray(value)) {
    return `${value.length} item${value.length === 1 ? "" : "s"}`;
  }

  if (typeof value === "object") {
    return "Updated";
  }

  return String(value);
}

function InvoiceDetailPage() {
  const { invoiceId } = useParams();
  const navigate = useNavigate();
  const { roles } = useAuth();
  const [meta, setMeta] = useState({ suppliers: [], users: [] });
  const [invoice, setInvoice] = useState(null);
  const [form, setForm] = useState(null);
  const [commentForm, setCommentForm] = useState({ commentText: "", isInternal: true });
  const [statusChangeReason, setStatusChangeReason] = useState("");
  const [approvalNote, setApprovalNote] = useState("");
  const [paymentForm, setPaymentForm] = useState(createEmptyPaymentForm());
  const [paymentEditForms, setPaymentEditForms] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCommentSaving, setIsCommentSaving] = useState(false);
  const [isApprovalSaving, setIsApprovalSaving] = useState(false);
  const [isPaymentSaving, setIsPaymentSaving] = useState(false);
  const [savingPaymentId, setSavingPaymentId] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [saveMessage, setSaveMessage] = useState("");

  async function loadInvoice() {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const [invoiceResponse, metaResponse] = await Promise.all([
        fetchInvoiceById(invoiceId),
        fetchInvoiceMeta()
      ]);

      setInvoice(invoiceResponse);
      setForm(toInvoiceForm(invoiceResponse));
      setPaymentForm(createEmptyPaymentForm(invoiceResponse));
      setPaymentEditForms(
        Object.fromEntries(
          (invoiceResponse.payments || []).map((payment) => [payment.paymentId, toPaymentForm(payment)])
        )
      );
      setMeta(metaResponse);
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadInvoice();
  }, [invoiceId]);

  const canEditInvoice = canEditInvoiceForRoles(roles);
  const canComment = canCommentForRoles(roles);
  const canManagePayments = canManagePaymentsForRoles(roles);
  const approval = invoice?.approval || null;
  const canSubmitForApproval =
    canEditInvoice &&
    approval?.workflow &&
    invoice?.status !== "pending_approval" &&
    invoice?.status !== "approved";
  const canTakeApprovalAction = Boolean(approval?.canCurrentUserAct);
  const isStatusAutoManaged = ["pending_approval", "approved", "rejected", "sent_back"].includes(
    form?.status || ""
  );
  const canCreatePayment = canManagePayments && invoice?.status === "approved";

  function handleFieldChange(event) {
    const { name, value, checked, type } = event.target;
    setForm((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value
    }));
    setSaveMessage("");
  }

  function handleSupplierChange(event) {
    const nextSupplierId = event.target.value;
    const supplier = meta.suppliers.find((item) => String(item.supplierId) === nextSupplierId);

    setForm((current) => ({
      ...current,
      supplierId: nextSupplierId,
      currency: supplier?.defaultCurrency || current.currency
    }));
    setSaveMessage("");
  }

  function handleAttachmentChange(index, field, value) {
    setForm((current) => ({
      ...current,
      attachmentMetadata: current.attachmentMetadata.map((attachment, attachmentIndex) =>
        attachmentIndex === index ? { ...attachment, [field]: value } : attachment
      )
    }));
    setSaveMessage("");
  }

  function addAttachmentRow() {
    setForm((current) => ({
      ...current,
      attachmentMetadata: [...current.attachmentMetadata, emptyAttachment()]
    }));
  }

  function removeAttachmentRow(index) {
    setForm((current) => ({
      ...current,
      attachmentMetadata: current.attachmentMetadata.filter((_, attachmentIndex) => attachmentIndex !== index)
    }));
    setSaveMessage("");
  }

  function applyInvoiceResponse(nextInvoice, successMessage = "") {
    setInvoice(nextInvoice);
    setForm(toInvoiceForm(nextInvoice));
    setPaymentForm(createEmptyPaymentForm(nextInvoice));
    setPaymentEditForms(
      Object.fromEntries((nextInvoice.payments || []).map((payment) => [payment.paymentId, toPaymentForm(payment)]))
    );
    setApprovalNote("");
    setStatusChangeReason("");
    setSaveMessage(successMessage);
  }

  async function handleSave(event) {
    event.preventDefault();
    setIsSaving(true);
    setErrorMessage("");
    setSaveMessage("");

    try {
      const updatedInvoice = await updateInvoice(invoiceId, {
        ...toInvoicePayload(form),
        statusChangeReason: statusChangeReason || null
      });

      applyInvoiceResponse(updatedInvoice, "Invoice updated successfully.");
    } catch (error) {
      setErrorMessage(error.details?.join(" ") || error.message);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    const confirmed = window.confirm("Delete this invoice? This cannot be undone.");

    if (!confirmed) {
      return;
    }

    setIsDeleting(true);
    setErrorMessage("");

    try {
      await deleteInvoice(invoiceId);
      navigate("/invoice-inbox");
    } catch (error) {
      setErrorMessage(error.message);
      setIsDeleting(false);
    }
  }

  async function handleCommentSubmit(event) {
    event.preventDefault();
    setIsCommentSaving(true);
    setErrorMessage("");

    try {
      const comment = await createInvoiceComment(invoiceId, commentForm);
      setInvoice((current) => ({
        ...current,
        comments: [comment, ...(current?.comments || [])]
      }));
      setCommentForm({ commentText: "", isInternal: true });
      await loadInvoice();
    } catch (error) {
      setErrorMessage(error.details?.join(" ") || error.message);
    } finally {
      setIsCommentSaving(false);
    }
  }

  async function handleSubmitForApproval() {
    setIsApprovalSaving(true);
    setErrorMessage("");
    setSaveMessage("");

    try {
      const nextInvoice = await submitInvoiceForApproval(invoiceId);
      applyInvoiceResponse(nextInvoice, "Invoice submitted for approval.");
    } catch (error) {
      setErrorMessage(error.details?.join(" ") || error.message);
    } finally {
      setIsApprovalSaving(false);
    }
  }

  async function handleApprovalDecision(actionType) {
    setIsApprovalSaving(true);
    setErrorMessage("");
    setSaveMessage("");

    try {
      const nextInvoice = await submitApprovalDecision(invoiceId, {
        actionType,
        actionNotes: approvalNote || null
      });
      applyInvoiceResponse(nextInvoice, `Invoice ${APPROVAL_ACTION_LABELS[actionType].toLowerCase()}.`);
    } catch (error) {
      setErrorMessage(error.details?.join(" ") || error.message);
    } finally {
      setIsApprovalSaving(false);
    }
  }

  function applyPaymentToInvoice(nextPayment) {
    setInvoice((current) => {
      const currentPayments = current?.payments || [];
      const existingIndex = currentPayments.findIndex((payment) => payment.paymentId === nextPayment.paymentId);
      const nextPayments =
        existingIndex >= 0
          ? currentPayments.map((payment) =>
              payment.paymentId === nextPayment.paymentId ? nextPayment : payment
            )
          : [nextPayment, ...currentPayments];

      const hasPaidPayment = nextPayments.some((payment) => payment.paymentStatus === "paid");

      return {
        ...current,
        paymentStatus: nextPayment.paymentStatus,
        status: hasPaidPayment ? "paid" : current.status === "paid" ? "approved" : current.status,
        payments: nextPayments
      };
    });

    setPaymentEditForms((current) => ({
      ...current,
      [nextPayment.paymentId]: toPaymentForm(nextPayment)
    }));
  }

  function handlePaymentFormChange(event) {
    const { name, value } = event.target;
    setPaymentForm((current) => ({ ...current, [name]: value }));
    setSaveMessage("");
  }

  function handlePaymentEditFieldChange(paymentId, field, value) {
    setPaymentEditForms((current) => ({
      ...current,
      [paymentId]: {
        ...current[paymentId],
        [field]: value
      }
    }));
    setSaveMessage("");
  }

  async function handleCreatePayment(event) {
    event.preventDefault();
    setIsPaymentSaving(true);
    setErrorMessage("");
    setSaveMessage("");

    try {
      const nextPayment = await createPayment(toPaymentPayload(paymentForm));
      applyPaymentToInvoice(nextPayment);
      setPaymentForm(createEmptyPaymentForm(invoice));
      setSaveMessage("Payment created successfully.");
      await loadInvoice();
    } catch (error) {
      setErrorMessage(error.details?.join(" ") || error.message);
    } finally {
      setIsPaymentSaving(false);
    }
  }

  async function handleUpdatePayment(paymentId) {
    setSavingPaymentId(paymentId);
    setErrorMessage("");
    setSaveMessage("");

    try {
      const nextPayment = await updatePayment(paymentId, toPaymentUpdatePayload(paymentEditForms[paymentId]));
      applyPaymentToInvoice(nextPayment);
      setSaveMessage("Payment updated successfully.");
      await loadInvoice();
    } catch (error) {
      setErrorMessage(error.details?.join(" ") || error.message);
    } finally {
      setSavingPaymentId(null);
    }
  }

  if (isLoading || !form) {
    return (
      <>
        <PageHeader title="Invoice Detail" description="Loading invoice..." />
        {errorMessage ? <div className="alert alert-danger">{errorMessage}</div> : null}
      </>
    );
  }

  const extractionData = invoice.extractionData;
  const extractionFields = EXTRACTION_FIELDS.map((field) => ({
    ...field,
    ...extractionData?.fields?.[field.key]
  }));

  return (
    <>
      <PageHeader
        title={invoice.invoiceNumber ? `Invoice ${invoice.invoiceNumber}` : `Invoice #${invoice.invoiceId}`}
        description="Review extracted fields, route ownership, and maintain the complete audit trail."
        actions={
          <>
            {canEditInvoice ? (
              <>
                <button className="btn btn-outline-danger" disabled={isDeleting} onClick={handleDelete} type="button">
                  {isDeleting ? "Deleting..." : "Delete"}
                </button>
                <button className="btn btn-primary" disabled={isSaving} form="invoice-detail-form" type="submit">
                  {isSaving ? "Saving..." : "Save changes"}
                </button>
              </>
            ) : null}
          </>
        }
      />

      {errorMessage ? <div className="alert alert-danger">{errorMessage}</div> : null}
      {saveMessage ? <div className="alert alert-success">{saveMessage}</div> : null}

      <div className="row g-3">
        <div className="col-12 col-xl-8">
          <form className="card border-0 shadow-sm h-100" id="invoice-detail-form" onSubmit={handleSave}>
            <div className="card-body">
              <fieldset disabled={!canEditInvoice}>
                <div className="d-flex flex-column flex-md-row justify-content-between gap-3 mb-4">
                  <div>
                    <h2 className="h5 mb-1">Invoice fields</h2>
                    <p className="text-secondary mb-0">
                      Edit extracted values, validation notes, assignment, and routing status.
                    </p>
                  </div>
                  <StatusBadge status={form.status} />
                </div>

                {!canEditInvoice ? (
                  <div className="alert alert-secondary py-2 px-3">
                    This invoice is read-only for your role. Approval actions are handled in the approval panel.
                  </div>
                ) : null}

                <div className="row g-3">
                <div className="col-12 col-md-6">
                  <label className="form-label">Supplier</label>
                  <select className="form-select" onChange={handleSupplierChange} value={form.supplierId}>
                    <option value="">Select supplier</option>
                    {meta.suppliers.map((supplier) => (
                      <option key={supplier.supplierId} value={supplier.supplierId}>
                        {supplier.supplierName}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-12 col-md-6">
                  <label className="form-label">Assigned user</label>
                  <select
                    className="form-select"
                    name="assignedUserId"
                    onChange={handleFieldChange}
                    value={form.assignedUserId}
                  >
                    <option value="">Unassigned</option>
                    {meta.users.map((user) => (
                      <option key={user.userId} value={user.userId}>
                        {user.fullName || user.email}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-12 col-md-4">
                  <label className="form-label">Invoice number</label>
                  <input
                    className="form-control"
                    name="invoiceNumber"
                    onChange={handleFieldChange}
                    value={form.invoiceNumber}
                  />
                </div>
                <div className="col-12 col-md-4">
                  <label className="form-label">Invoice date</label>
                  <input
                    className="form-control"
                    name="invoiceDate"
                    onChange={handleFieldChange}
                    type="date"
                    value={form.invoiceDate}
                  />
                </div>
                <div className="col-12 col-md-4">
                  <label className="form-label">Due date</label>
                  <input
                    className="form-control"
                    name="dueDate"
                    onChange={handleFieldChange}
                    type="date"
                    value={form.dueDate}
                  />
                </div>
                <div className="col-12 col-md-3">
                  <label className="form-label">Subtotal</label>
                  <input
                    className="form-control"
                    inputMode="decimal"
                    name="subtotal"
                    onChange={handleFieldChange}
                    value={form.subtotal}
                  />
                </div>
                <div className="col-12 col-md-3">
                  <label className="form-label">Tax</label>
                  <input
                    className="form-control"
                    inputMode="decimal"
                    name="tax"
                    onChange={handleFieldChange}
                    value={form.tax}
                  />
                </div>
                <div className="col-12 col-md-3">
                  <label className="form-label">Total</label>
                  <input
                    className="form-control"
                    inputMode="decimal"
                    name="total"
                    onChange={handleFieldChange}
                    value={form.total}
                  />
                </div>
                <div className="col-12 col-md-3">
                  <label className="form-label">Currency</label>
                  <input
                    className="form-control"
                    maxLength="3"
                    name="currency"
                    onChange={handleFieldChange}
                    value={form.currency}
                  />
                </div>
                <div className="col-12 col-md-6">
                  <label className="form-label">External PO number</label>
                  <input
                    className="form-control"
                    name="externalPoNumber"
                    onChange={handleFieldChange}
                    value={form.externalPoNumber}
                  />
                </div>
                <div className="col-12 col-md-6">
                  <label className="form-label">Status</label>
                  <select
                    className="form-select"
                    disabled={isStatusAutoManaged}
                    name="status"
                    onChange={handleFieldChange}
                    value={form.status}
                  >
                    {[...new Set([form.status, ...MANUAL_INVOICE_STATUSES])].map((status) => (
                      <option key={status} value={status}>
                        {STATUS_LABELS[status] || status}
                      </option>
                    ))}
                  </select>
                  {isStatusAutoManaged ? (
                    <div className="form-text">Approval statuses update automatically from workflow actions.</div>
                  ) : null}
                </div>
                <div className="col-12 col-md-6">
                  <label className="form-label">Hold reason</label>
                  <input
                    className="form-control"
                    name="holdReason"
                    onChange={handleFieldChange}
                    placeholder="Reason if the invoice is blocked"
                    value={form.holdReason}
                  />
                </div>
                <div className="col-12 col-md-6">
                  <label className="form-label">Status change reason</label>
                  <input
                    className="form-control"
                    onChange={(event) => setStatusChangeReason(event.target.value)}
                    placeholder="Optional note for the history log"
                    value={statusChangeReason}
                  />
                </div>
                <div className="col-12">
                  <div className="d-flex flex-wrap gap-3">
                    <div className="form-check">
                      <input
                        checked={form.externalPoVerified}
                        className="form-check-input"
                        id="externalPoVerified"
                        name="externalPoVerified"
                        onChange={handleFieldChange}
                        type="checkbox"
                      />
                      <label className="form-check-label" htmlFor="externalPoVerified">
                        External PO verified
                      </label>
                    </div>
                    <div className="form-check">
                      <input
                        checked={form.duplicateFlag}
                        className="form-check-input"
                        id="duplicateFlag"
                        name="duplicateFlag"
                        onChange={handleFieldChange}
                        type="checkbox"
                      />
                      <label className="form-check-label" htmlFor="duplicateFlag">
                        Mark as duplicate
                      </label>
                    </div>
                  </div>
                </div>
                <div className="col-12">
                  <label className="form-label">Verification notes</label>
                  <textarea
                    className="form-control"
                    name="verificationNotes"
                    onChange={handleFieldChange}
                    rows="4"
                    value={form.verificationNotes}
                  />
                </div>
                </div>
              </fieldset>
            </div>
          </form>
        </div>

        <div className="col-12 col-xl-4">
          <div className="card border-0 shadow-sm mb-3">
            <div className="card-body">
              <h2 className="h5 mb-3">Summary</h2>
              <dl className="row mb-0">
                <dt className="col-6 text-secondary">Supplier</dt>
                <dd className="col-6 text-end">{invoice.supplierName}</dd>
                <dt className="col-6 text-secondary">Total</dt>
                <dd className="col-6 text-end">{formatCurrency(invoice.total, invoice.currency)}</dd>
                <dt className="col-6 text-secondary">Assigned</dt>
                <dd className="col-6 text-end">{invoice.assignedUserName || "Unassigned"}</dd>
                <dt className="col-6 text-secondary">Payment</dt>
                <dd className="col-6 text-end">
                  <StatusBadge status={invoice.paymentStatus || "unpaid"} />
                </dd>
                <dt className="col-6 text-secondary">Created</dt>
                <dd className="col-6 text-end">{formatDateTime(invoice.createdAt)}</dd>
                <dt className="col-6 text-secondary">Updated</dt>
                <dd className="col-6 text-end">{formatDateTime(invoice.updatedAt)}</dd>
              </dl>
            </div>
          </div>

          <div className="card border-0 shadow-sm mb-3">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
                <div>
                  <h2 className="h5 mb-1">Approval workflow</h2>
                  <p className="text-secondary mb-0">
                    Submit the invoice into approval and track the current approval step.
                  </p>
                </div>
                <StatusBadge status={invoice.status} />
              </div>

              {approval?.workflow ? (
                <>
                  <dl className="row small mb-3">
                    <dt className="col-5 text-secondary">Workflow</dt>
                    <dd className="col-7 text-end">{approval.workflow.workflowName}</dd>
                    <dt className="col-5 text-secondary">Code</dt>
                    <dd className="col-7 text-end">{approval.workflow.workflowCode}</dd>
                    <dt className="col-5 text-secondary">Round</dt>
                    <dd className="col-7 text-end">{approval.currentRound || "Not started"}</dd>
                    <dt className="col-5 text-secondary">Current step</dt>
                    <dd className="col-7 text-end">{approval.currentStep?.stepName || "None"}</dd>
                  </dl>

                  <div className="list-group list-group-flush mb-3">
                    {approval.steps.map((step) => (
                      <div className="list-group-item px-0" key={step.approvalStepId}>
                        <div className="d-flex justify-content-between gap-3">
                          <div>
                            <div className="fw-semibold">
                              {step.stepOrder}. {step.stepName}
                            </div>
                            <div className="small text-secondary">{step.approverLabel}</div>
                          </div>
                          <div className="text-end">
                            <StatusBadge status={step.state} />
                            <div className="small text-secondary mt-1">
                              {step.approvedCount}/{step.minApprovalsRequired} approvals
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {canSubmitForApproval ? (
                    <button className="btn btn-primary w-100" disabled={isApprovalSaving} onClick={handleSubmitForApproval} type="button">
                      {isApprovalSaving ? "Submitting..." : "Submit for approval"}
                    </button>
                  ) : null}

                  {canTakeApprovalAction ? (
                    <>
                      <div className="mb-3">
                        <label className="form-label">Approval note</label>
                        <textarea
                          className="form-control"
                          onChange={(event) => setApprovalNote(event.target.value)}
                          rows="3"
                          value={approvalNote}
                        />
                      </div>
                      <div className="d-flex flex-wrap gap-2">
                        <button
                          className="btn btn-success"
                          disabled={isApprovalSaving}
                          onClick={() => handleApprovalDecision("approve")}
                          type="button"
                        >
                          Approve
                        </button>
                        <button
                          className="btn btn-outline-secondary"
                          disabled={isApprovalSaving}
                          onClick={() => handleApprovalDecision("send_back")}
                          type="button"
                        >
                          Send back
                        </button>
                        <button
                          className="btn btn-outline-danger"
                          disabled={isApprovalSaving}
                          onClick={() => handleApprovalDecision("reject")}
                          type="button"
                        >
                          Reject
                        </button>
                      </div>
                    </>
                  ) : null}
                </>
              ) : (
                <div className="text-secondary">No active approval workflow matches this invoice yet.</div>
              )}
            </div>
          </div>

          <div className="card border-0 shadow-sm mb-3">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
                <div>
                  <h2 className="h5 mb-1">Payments</h2>
                  <p className="text-secondary mb-0">
                    Finance tracks payment progress manually for this invoice.
                  </p>
                </div>
                <StatusBadge status={invoice.paymentStatus || "unpaid"} />
              </div>

              {canManagePayments ? (
                <>
                  {canCreatePayment ? (
                    <form className="border rounded p-3 mb-3" onSubmit={handleCreatePayment}>
                      <div className="row g-3">
                        <div className="col-12 col-md-6">
                          <label className="form-label">Initial status</label>
                          <select
                            className="form-select"
                            name="paymentStatus"
                            onChange={handlePaymentFormChange}
                            value={paymentForm.paymentStatus}
                          >
                            {Object.entries(PAYMENT_STATUS_LABELS).map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="col-12 col-md-6">
                          <label className="form-label">Reference</label>
                          <input
                            className="form-control"
                            name="paymentReference"
                            onChange={handlePaymentFormChange}
                            value={paymentForm.paymentReference}
                          />
                        </div>
                        <div className="col-12 col-md-6">
                          <label className="form-label">Payment date</label>
                          <input
                            className="form-control"
                            name="paymentDate"
                            onChange={handlePaymentFormChange}
                            type="date"
                            value={paymentForm.paymentDate}
                          />
                        </div>
                        <div className="col-12">
                          <label className="form-label">Notes</label>
                          <textarea
                            className="form-control"
                            name="notes"
                            onChange={handlePaymentFormChange}
                            rows="2"
                            value={paymentForm.notes}
                          />
                        </div>
                      </div>
                      <button className="btn btn-primary mt-3" disabled={isPaymentSaving} type="submit">
                        {isPaymentSaving ? "Creating..." : "Create payment"}
                      </button>
                    </form>
                  ) : (
                    <div className="alert alert-secondary py-2 px-3">
                      Payment records can be created once the invoice is approved.
                    </div>
                  )}
                </>
              ) : (
                <div className="alert alert-secondary py-2 px-3">
                  Payment updates are restricted to AP admins and finance managers.
                </div>
              )}

              <div className="list-group list-group-flush">
                {invoice.payments?.length ? (
                  invoice.payments.map((payment) => {
                    const editableStatuses = getAllowedNextPaymentStatuses(payment.paymentStatus);

                    return (
                      <div className="list-group-item px-0" key={payment.paymentId}>
                        <div className="d-flex justify-content-between gap-3 mb-3">
                          <div>
                            <div className="fw-semibold">Payment #{payment.paymentId}</div>
                            <div className="small text-secondary">
                              Created {formatDateTime(payment.createdAt)}
                            </div>
                          </div>
                          <StatusBadge status={payment.paymentStatus} />
                        </div>

                        {canManagePayments ? (
                          <>
                            <div className="row g-3">
                              <div className="col-12 col-md-6">
                                <label className="form-label">Status</label>
                                <select
                                  className="form-select"
                                  onChange={(event) =>
                                    handlePaymentEditFieldChange(
                                      payment.paymentId,
                                      "paymentStatus",
                                      event.target.value
                                    )
                                  }
                                  value={paymentEditForms[payment.paymentId]?.paymentStatus || payment.paymentStatus}
                                >
                                  {editableStatuses.map((status) => (
                                    <option key={status} value={status}>
                                      {PAYMENT_STATUS_LABELS[status] || status}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div className="col-12 col-md-6">
                                <label className="form-label">Reference</label>
                                <input
                                  className="form-control"
                                  onChange={(event) =>
                                    handlePaymentEditFieldChange(
                                      payment.paymentId,
                                      "paymentReference",
                                      event.target.value
                                    )
                                  }
                                  value={paymentEditForms[payment.paymentId]?.paymentReference || ""}
                                />
                              </div>
                              <div className="col-12 col-md-6">
                                <label className="form-label">Payment date</label>
                                <input
                                  className="form-control"
                                  onChange={(event) =>
                                    handlePaymentEditFieldChange(
                                      payment.paymentId,
                                      "paymentDate",
                                      event.target.value
                                    )
                                  }
                                  type="date"
                                  value={paymentEditForms[payment.paymentId]?.paymentDate || ""}
                                />
                              </div>
                              <div className="col-12">
                                <label className="form-label">Notes</label>
                                <textarea
                                  className="form-control"
                                  onChange={(event) =>
                                    handlePaymentEditFieldChange(payment.paymentId, "notes", event.target.value)
                                  }
                                  rows="2"
                                  value={paymentEditForms[payment.paymentId]?.notes || ""}
                                />
                              </div>
                            </div>
                            <button
                              className="btn btn-outline-primary mt-3"
                              disabled={savingPaymentId === payment.paymentId}
                              onClick={() => handleUpdatePayment(payment.paymentId)}
                              type="button"
                            >
                              {savingPaymentId === payment.paymentId ? "Saving..." : "Update payment"}
                            </button>
                          </>
                        ) : (
                          <dl className="row small mb-0">
                            <dt className="col-5 text-secondary">Reference</dt>
                            <dd className="col-7 text-end">{payment.paymentReference || "Not recorded"}</dd>
                            <dt className="col-5 text-secondary">Payment date</dt>
                            <dd className="col-7 text-end">{payment.paymentDate || "Not recorded"}</dd>
                            <dt className="col-5 text-secondary">Notes</dt>
                            <dd className="col-7 text-end">{payment.notes || "None"}</dd>
                          </dl>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="text-secondary">No payments recorded for this invoice yet.</div>
                )}
              </div>
            </div>
          </div>

          <div className="card border-0 shadow-sm mb-3">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
                <div>
                  <h2 className="h5 mb-1">Extraction review</h2>
                  <p className="text-secondary mb-0">
                    Suggested values are saved on the invoice for review and correction.
                  </p>
                </div>
                <div className="d-flex flex-wrap gap-2 justify-content-end">
                  <span className={`badge text-bg-${toneForExtractionStatus(invoice.extractionStatus)}`}>
                    {EXTRACTION_STATUS_LABELS[invoice.extractionStatus] || "Unknown"}
                  </span>
                  {invoice.extractionConfidence ? (
                    <span
                      className={`badge text-bg-${toneForExtractionConfidence(invoice.extractionConfidence)}`}
                    >
                      {EXTRACTION_CONFIDENCE_LABELS[invoice.extractionConfidence] || invoice.extractionConfidence}
                    </span>
                  ) : null}
                </div>
              </div>

              <dl className="row small mb-3">
                <dt className="col-5 text-secondary">Provider</dt>
                <dd className="col-7 text-end">{extractionData?.providerId || "Not available"}</dd>
                <dt className="col-5 text-secondary">Version</dt>
                <dd className="col-7 text-end">{extractionData?.providerVersion || "Not available"}</dd>
              </dl>

              {extractionData ? (
                <div className="list-group list-group-flush">
                  {extractionFields.map((field) => (
                    <div className="list-group-item px-0" key={field.key}>
                      <div className="d-flex justify-content-between gap-3">
                        <div>
                          <div className="fw-semibold">{field.label}</div>
                          <div className="small text-secondary">
                            Source: {field.source || "No extracted source"}
                          </div>
                        </div>
                        <div className="text-end">
                          <div>{formatExtractedFieldValue(field, invoice.currency)}</div>
                          <span className={`badge text-bg-${toneForExtractionConfidence(field.confidence)}`}>
                            {EXTRACTION_CONFIDENCE_LABELS[field.confidence] || "Low"}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-secondary">No extracted field suggestions are stored for this invoice yet.</div>
              )}

              {extractionData?.notes?.length ? (
                <div className="alert alert-warning py-2 px-3 mt-3 mb-0">
                  {extractionData.notes.map((note) => (
                    <div key={note}>{note}</div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          <div className="card border-0 shadow-sm">
            <div className="card-body">
              <h2 className="h5 mb-3">Approval action history</h2>
              <div className="list-group list-group-flush">
                {approval?.history?.length ? (
                  approval.history.map((entry) => (
                    <div className="list-group-item px-0" key={entry.approvalActionId}>
                      <div className="d-flex justify-content-between gap-3">
                        <div>
                          <div className="fw-semibold">
                            {APPROVAL_ACTION_LABELS[entry.actionType] || entry.actionType}
                            {" · "}
                            {entry.stepName}
                          </div>
                          <div className="small text-secondary">
                            Round {entry.approvalRound}
                            {entry.actionNotes ? ` · ${entry.actionNotes}` : ""}
                          </div>
                        </div>
                        <div className="text-end small text-secondary">
                          <div>{entry.actionByUserName}</div>
                          <div>{formatDateTime(entry.actionAt)}</div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-secondary">No approval actions recorded yet.</div>
                )}
              </div>
            </div>
          </div>

          <div className="card border-0 shadow-sm mt-3">
            <div className="card-body">
              <h2 className="h5 mb-3">Status history</h2>
              <div className="list-group list-group-flush">
                {invoice.statusHistory?.length ? (
                  invoice.statusHistory.map((entry) => (
                    <div className="list-group-item px-0" key={entry.statusHistoryId}>
                      <div className="d-flex justify-content-between gap-3">
                        <div>
                          <div className="fw-semibold">
                            {(entry.fromStatus && STATUS_LABELS[entry.fromStatus]) || "Created"}{" "}
                            {" -> "} {STATUS_LABELS[entry.toStatus] || entry.toStatus}
                          </div>
                          <div className="text-secondary small">
                            {entry.changeReason || "No reason provided"}
                          </div>
                        </div>
                        <div className="text-end small text-secondary">
                          <div>{entry.changedByUserName || "System"}</div>
                          <div>{formatDateTime(entry.changedAt)}</div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-secondary">No status changes recorded yet.</div>
                )}
              </div>
            </div>
          </div>

          <div className="card border-0 shadow-sm mt-3">
            <div className="card-body">
              <h2 className="h5 mb-3">Audit history</h2>
              <div className="list-group list-group-flush">
                {invoice.auditHistory?.length ? (
                  invoice.auditHistory.map((entry) => (
                    <div className="list-group-item px-0" key={entry.auditLogId}>
                      <div className="d-flex justify-content-between gap-3 mb-2">
                        <div>
                          <div className="fw-semibold">
                            {entry.actionLabel || AUDIT_EVENT_LABELS[entry.eventType] || entry.eventType}
                          </div>
                          <div className="small text-secondary">
                            {AUDIT_EVENT_LABELS[entry.eventType] || entry.eventType}
                            {entry.targetType !== "invoice" && entry.targetId
                              ? ` · ${entry.targetType} #${entry.targetId}`
                              : ""}
                          </div>
                        </div>
                        <div className="text-end small text-secondary">
                          <div>{entry.actorUserName || "System"}</div>
                          <div>{formatDateTime(entry.createdAt)}</div>
                        </div>
                      </div>

                      {entry.changedFields?.length ? (
                        <div className="small">
                          {entry.changedFields.map((change, index) => (
                            <div className="mb-1" key={`${entry.auditLogId}-${change.field}-${index}`}>
                              <span className="fw-semibold">{change.label || change.field}:</span>{" "}
                              {formatAuditValue(change.field, change.from, invoice.currency)} {" -> "}{" "}
                              {formatAuditValue(change.field, change.to, invoice.currency)}
                            </div>
                          ))}
                        </div>
                      ) : null}

                      {entry.metadata?.reason ? (
                        <div className="small text-secondary mt-2">Reason: {entry.metadata.reason}</div>
                      ) : null}

                      {entry.metadata?.stepName ? (
                        <div className="small text-secondary mt-2">
                          Step: {entry.metadata.stepName}
                          {entry.metadata.approvalRound ? ` · Round ${entry.metadata.approvalRound}` : ""}
                        </div>
                      ) : null}

                      {entry.metadata?.notes ? (
                        <div className="small text-secondary mt-2">Notes: {entry.metadata.notes}</div>
                      ) : null}
                    </div>
                  ))
                ) : (
                  <div className="text-secondary">No audit events recorded yet.</div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="col-12">
          <div className="card border-0 shadow-sm">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <div>
                  <h2 className="h5 mb-1">Attachment metadata</h2>
                  <p className="text-secondary mb-0">
                    Keep document metadata aligned with the stored invoice files.
                  </p>
                </div>
                {canEditInvoice ? (
                  <button className="btn btn-outline-secondary" onClick={addAttachmentRow} type="button">
                    Add attachment
                  </button>
                ) : null}
              </div>

              <fieldset disabled={!canEditInvoice}>
                <div className="row g-3">
                {form.attachmentMetadata.length ? (
                  form.attachmentMetadata.map((attachment, index) => (
                    <div className="col-12" key={`${attachment.fileName}-${index}`}>
                      <div className="border rounded p-3">
                        <div className="row g-3">
                          <div className="col-12 col-md-4">
                            <label className="form-label">File name</label>
                            <input
                              className="form-control"
                              onChange={(event) =>
                                handleAttachmentChange(index, "fileName", event.target.value)
                              }
                              value={attachment.fileName}
                            />
                          </div>
                          <div className="col-12 col-md-4">
                            <label className="form-label">Original file name</label>
                            <input
                              className="form-control"
                              onChange={(event) =>
                                handleAttachmentChange(index, "originalFileName", event.target.value)
                              }
                              value={attachment.originalFileName}
                            />
                          </div>
                          <div className="col-12 col-md-4">
                            <label className="form-label">Mime type</label>
                            <input
                              className="form-control"
                              onChange={(event) =>
                                handleAttachmentChange(index, "mimeType", event.target.value)
                              }
                              value={attachment.mimeType}
                            />
                          </div>
                          <div className="col-12 col-md-3">
                            <label className="form-label">File size bytes</label>
                            <input
                              className="form-control"
                              onChange={(event) =>
                                handleAttachmentChange(index, "fileSizeBytes", event.target.value)
                              }
                              value={attachment.fileSizeBytes}
                            />
                          </div>
                          <div className="col-12 col-md-3">
                            <label className="form-label">Storage provider</label>
                            <input
                              className="form-control"
                              onChange={(event) =>
                                handleAttachmentChange(index, "storageProvider", event.target.value)
                              }
                              value={attachment.storageProvider}
                            />
                          </div>
                          <div className="col-12 col-md-6">
                            <label className="form-label">Storage path</label>
                            <input
                              className="form-control"
                              onChange={(event) =>
                                handleAttachmentChange(index, "storagePath", event.target.value)
                              }
                              value={attachment.storagePath}
                            />
                          </div>
                          <div className="col-12 col-md-6">
                            <label className="form-label">Checksum</label>
                            <input
                              className="form-control"
                              onChange={(event) =>
                                handleAttachmentChange(index, "fileChecksumSha256", event.target.value)
                              }
                              value={attachment.fileChecksumSha256}
                            />
                          </div>
                          <div className="col-12 col-md-4">
                            <label className="form-label">Uploaded at</label>
                            <input
                              className="form-control"
                              onChange={(event) =>
                                handleAttachmentChange(index, "uploadedAt", event.target.value)
                              }
                              placeholder="2026-04-20T10:00:00Z"
                              value={attachment.uploadedAt}
                            />
                          </div>
                          <div className="col-12 col-md-4 d-flex align-items-end">
                            <div className="form-check">
                              <input
                                checked={attachment.isPrimaryDocument}
                                className="form-check-input"
                                id={`primary-document-${index}`}
                                onChange={(event) =>
                                  handleAttachmentChange(index, "isPrimaryDocument", event.target.checked)
                                }
                                type="checkbox"
                              />
                              <label className="form-check-label" htmlFor={`primary-document-${index}`}>
                                Primary document
                              </label>
                            </div>
                          </div>
                          <div className="col-12 col-md-4 d-flex align-items-end justify-content-md-end">
                            {canEditInvoice ? (
                              <button
                                className="btn btn-outline-danger"
                                onClick={() => removeAttachmentRow(index)}
                                type="button"
                              >
                                Remove
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-secondary">No attachment metadata recorded.</div>
                )}
                </div>
              </fieldset>
            </div>
          </div>
        </div>

        <div className="col-12 col-xl-6">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <h2 className="h5 mb-3">Comments</h2>
              {canComment ? <form className="mb-4" onSubmit={handleCommentSubmit}>
                <div className="mb-3">
                  <label className="form-label">Add comment</label>
                  <textarea
                    className="form-control"
                    onChange={(event) =>
                      setCommentForm((current) => ({ ...current, commentText: event.target.value }))
                    }
                    rows="3"
                    value={commentForm.commentText}
                  />
                </div>
                <div className="d-flex justify-content-between align-items-center">
                  <div className="form-check">
                    <input
                      checked={commentForm.isInternal}
                      className="form-check-input"
                      id="isInternalComment"
                      onChange={(event) =>
                        setCommentForm((current) => ({
                          ...current,
                          isInternal: event.target.checked
                        }))
                      }
                      type="checkbox"
                    />
                    <label className="form-check-label" htmlFor="isInternalComment">
                      Internal comment
                    </label>
                  </div>
                  <button className="btn btn-primary" disabled={isCommentSaving} type="submit">
                    {isCommentSaving ? "Posting..." : "Post comment"}
                  </button>
                </div>
              </form> : <div className="alert alert-secondary py-2 px-3">Comments are read-only for your role.</div>}

              <div className="list-group list-group-flush">
                {invoice.comments?.length ? (
                  invoice.comments.map((comment) => (
                    <div className="list-group-item px-0" key={comment.commentId}>
                      <div className="d-flex justify-content-between gap-3 mb-2">
                        <div className="fw-semibold">{comment.createdByUserName}</div>
                        <div className="small text-secondary">{formatDateTime(comment.createdAt)}</div>
                      </div>
                      <div className="mb-2">{comment.commentText}</div>
                      <div className="small text-secondary">
                        {comment.isInternal ? "Internal note" : "Shared comment"}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-secondary">No comments recorded yet.</div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="col-12 col-xl-6">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <h2 className="h5 mb-3">Extracted field snapshot</h2>
              <div className="invoice-preview-placeholder rounded border bg-light p-3">
                <pre className="mb-0 small">{JSON.stringify(invoice.extractedFields || {}, null, 2)}</pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default InvoiceDetailPage;
