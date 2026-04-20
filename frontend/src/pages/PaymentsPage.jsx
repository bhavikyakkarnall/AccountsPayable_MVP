import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import DataTableCard from "../components/DataTableCard";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import {
  createEmptyPaymentForm,
  createPayment,
  fetchPaymentMeta,
  fetchPayments,
  getAllowedNextPaymentStatuses,
  PAYMENT_STATUS_LABELS,
  toPaymentPayload,
  toPaymentUpdatePayload,
  toPaymentForm,
  updatePayment
} from "../lib/payments";

function formatCurrency(amount, currency) {
  if (amount === null || amount === undefined || Number.isNaN(Number(amount))) {
    return "Not set";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD"
  }).format(Number(amount));
}

function formatDate(value) {
  if (!value) {
    return "Not scheduled";
  }

  return new Intl.DateTimeFormat("en-NZ", { dateStyle: "medium" }).format(new Date(value));
}

function PaymentsPage() {
  const [payments, setPayments] = useState([]);
  const [meta, setMeta] = useState({ payableInvoices: [] });
  const [createForm, setCreateForm] = useState(createEmptyPaymentForm());
  const [editForms, setEditForms] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [savingPaymentId, setSavingPaymentId] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  async function loadPayments() {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const [paymentsResponse, metaResponse] = await Promise.all([fetchPayments(), fetchPaymentMeta()]);
      setPayments(paymentsResponse);
      setMeta(metaResponse);
      setEditForms(
        Object.fromEntries(paymentsResponse.map((payment) => [payment.paymentId, toPaymentForm(payment)]))
      );

      setCreateForm((current) => {
        const hasCurrentInvoice = metaResponse.payableInvoices.some(
          (invoice) => String(invoice.invoiceId) === current.invoiceId
        );

        if (current.invoiceId && hasCurrentInvoice) {
          return current;
        }

        return createEmptyPaymentForm(metaResponse.payableInvoices[0] || null);
      });
    } catch (error) {
      setErrorMessage(error.details?.join(" ") || error.message);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadPayments();
  }, []);

  useEffect(() => {
    const selectedInvoice = meta.payableInvoices.find(
      (invoice) => String(invoice.invoiceId) === createForm.invoiceId
    );

    if (!selectedInvoice) {
      return;
    }

    setCreateForm((current) => ({
      ...current,
      amount:
        current.amount === "" || current.amount === String(selectedInvoice.totalAmount)
          ? String(selectedInvoice.totalAmount)
          : current.amount,
      currency: selectedInvoice.currency || current.currency
    }));
  }, [createForm.invoiceId, meta.payableInvoices]);

  const readyCount = payments.filter((payment) => payment.paymentStatus === "ready_for_payment").length;
  const submittedCount = payments.filter(
    (payment) => payment.paymentStatus === "payment_submitted"
  ).length;
  const paidCount = payments.filter((payment) => payment.paymentStatus === "paid").length;

  async function handleCreatePayment(event) {
    event.preventDefault();
    setIsCreating(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      await createPayment(toPaymentPayload(createForm));
      setSuccessMessage("Payment record created.");
      await loadPayments();
    } catch (error) {
      setErrorMessage(error.details?.join(" ") || error.message);
    } finally {
      setIsCreating(false);
    }
  }

  async function handleUpdatePayment(paymentId) {
    setSavingPaymentId(paymentId);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      await updatePayment(paymentId, toPaymentUpdatePayload(editForms[paymentId]));
      setSuccessMessage("Payment updated.");
      await loadPayments();
    } catch (error) {
      setErrorMessage(error.details?.join(" ") || error.message);
    } finally {
      setSavingPaymentId(null);
    }
  }

  function handleCreateFieldChange(event) {
    const { name, value } = event.target;
    setCreateForm((current) => ({ ...current, [name]: value }));
  }

  function handleEditFieldChange(paymentId, field, value) {
    setEditForms((current) => ({
      ...current,
      [paymentId]: {
        ...current[paymentId],
        [field]: value
      }
    }));
  }

  const rows = payments.map((payment) => ({
    id: payment.paymentId,
    invoice: (
      <div>
        <div className="fw-semibold">
          <Link to={`/invoices/${payment.invoiceId}`}>{payment.invoiceNumber || `Invoice #${payment.invoiceId}`}</Link>
        </div>
        <div className="small text-secondary">{payment.supplierName}</div>
      </div>
    ),
    amount: formatCurrency(payment.amount, payment.currency),
    status: <StatusBadge status={payment.paymentStatus} />,
    reference: payment.paymentReference || "Not recorded",
    date: formatDate(payment.paymentDate)
  }));

  return (
    <>
      <PageHeader
        title="Payments"
        description="Track manual payment progress from ready for payment through paid or failed."
      />

      {errorMessage ? <div className="alert alert-danger">{errorMessage}</div> : null}
      {successMessage ? <div className="alert alert-success">{successMessage}</div> : null}

      <div className="row g-3 mb-3">
        <div className="col-12 col-md-4">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <div className="text-secondary small mb-1">Ready for payment</div>
              <div className="display-6 mb-0">{readyCount}</div>
            </div>
          </div>
        </div>
        <div className="col-12 col-md-4">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <div className="text-secondary small mb-1">Submitted</div>
              <div className="display-6 mb-0">{submittedCount}</div>
            </div>
          </div>
        </div>
        <div className="col-12 col-md-4">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <div className="text-secondary small mb-1">Paid</div>
              <div className="display-6 mb-0">{paidCount}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="row g-3">
        <div className="col-12 col-xl-7">
          <DataTableCard
            title="Payment records"
            description="All manually tracked payment activity."
            columns={[
              { key: "invoice", label: "Invoice" },
              { key: "amount", label: "Amount" },
              { key: "status", label: "Status" },
              { key: "reference", label: "Reference" },
              { key: "date", label: "Payment date" }
            ]}
            emptyMessage={isLoading ? "Loading payments..." : "No payment records found."}
            rows={rows}
          />
        </div>

        <div className="col-12 col-xl-5">
          <div className="card border-0 shadow-sm mb-3">
            <div className="card-body">
              <h2 className="h5 mb-3">Create payment record</h2>
              <form onSubmit={handleCreatePayment}>
                <div className="mb-3">
                  <label className="form-label">Approved invoice</label>
                  <select
                    className="form-select"
                    name="invoiceId"
                    onChange={handleCreateFieldChange}
                    value={createForm.invoiceId}
                  >
                    <option value="">Select invoice</option>
                    {meta.payableInvoices.map((invoice) => (
                      <option key={invoice.invoiceId} value={invoice.invoiceId}>
                        {(invoice.invoiceNumber || `Invoice #${invoice.invoiceId}`) + ` · ${invoice.supplierName}`}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="row g-3">
                  <div className="col-12 col-md-6">
                    <label className="form-label">Status</label>
                    <select
                      className="form-select"
                      name="paymentStatus"
                      onChange={handleCreateFieldChange}
                      value={createForm.paymentStatus}
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
                      onChange={handleCreateFieldChange}
                      value={createForm.paymentReference}
                    />
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="form-label">Payment date</label>
                    <input
                      className="form-control"
                      name="paymentDate"
                      onChange={handleCreateFieldChange}
                      type="date"
                      value={createForm.paymentDate}
                    />
                  </div>
                  <div className="col-12 col-md-3">
                    <label className="form-label">Amount</label>
                    <input
                      className="form-control"
                      name="amount"
                      onChange={handleCreateFieldChange}
                      value={createForm.amount}
                    />
                  </div>
                  <div className="col-12 col-md-3">
                    <label className="form-label">Currency</label>
                    <input
                      className="form-control"
                      maxLength="3"
                      name="currency"
                      onChange={handleCreateFieldChange}
                      value={createForm.currency}
                    />
                  </div>
                  <div className="col-12">
                    <label className="form-label">Notes</label>
                    <textarea
                      className="form-control"
                      name="notes"
                      onChange={handleCreateFieldChange}
                      rows="3"
                      value={createForm.notes}
                    />
                  </div>
                </div>
                <button className="btn btn-primary mt-3" disabled={isCreating} type="submit">
                  {isCreating ? "Creating..." : "Create payment"}
                </button>
              </form>
            </div>
          </div>

          <div className="card border-0 shadow-sm">
            <div className="card-body">
              <h2 className="h5 mb-3">Update payment status</h2>
              <div className="list-group list-group-flush">
                {payments.length ? (
                  payments.map((payment) => (
                    <div className="list-group-item px-0" key={payment.paymentId}>
                      <div className="fw-semibold mb-2">
                        {payment.invoiceNumber || `Invoice #${payment.invoiceId}`} · {payment.supplierName}
                      </div>
                      <div className="row g-3">
                        <div className="col-12 col-md-6">
                          <label className="form-label">Status</label>
                          <select
                            className="form-select"
                            onChange={(event) =>
                              handleEditFieldChange(payment.paymentId, "paymentStatus", event.target.value)
                            }
                            value={editForms[payment.paymentId]?.paymentStatus || payment.paymentStatus}
                          >
                            {getAllowedNextPaymentStatuses(payment.paymentStatus).map((status) => (
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
                              handleEditFieldChange(payment.paymentId, "paymentReference", event.target.value)
                            }
                            value={editForms[payment.paymentId]?.paymentReference || ""}
                          />
                        </div>
                        <div className="col-12 col-md-6">
                          <label className="form-label">Payment date</label>
                          <input
                            className="form-control"
                            onChange={(event) =>
                              handleEditFieldChange(payment.paymentId, "paymentDate", event.target.value)
                            }
                            type="date"
                            value={editForms[payment.paymentId]?.paymentDate || ""}
                          />
                        </div>
                        <div className="col-12">
                          <label className="form-label">Notes</label>
                          <textarea
                            className="form-control"
                            onChange={(event) =>
                              handleEditFieldChange(payment.paymentId, "notes", event.target.value)
                            }
                            rows="2"
                            value={editForms[payment.paymentId]?.notes || ""}
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
                    </div>
                  ))
                ) : (
                  <div className="text-secondary">{isLoading ? "Loading payments..." : "No payments yet."}</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default PaymentsPage;
