import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import DataTableCard from "../components/DataTableCard";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import { APPROVAL_ACTION_LABELS, fetchApprovalQueue, submitApprovalDecision } from "../lib/approvals";

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

function ApprovalQueuePage() {
  const [items, setItems] = useState([]);
  const [decisionNotes, setDecisionNotes] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [activeInvoiceId, setActiveInvoiceId] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");

  async function loadQueue() {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const queue = await fetchApprovalQueue();
      setItems(queue);
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadQueue();
  }, []);

  async function handleDecision(invoiceId, actionType) {
    setActiveInvoiceId(invoiceId);
    setErrorMessage("");

    try {
      await submitApprovalDecision(invoiceId, {
        actionType,
        actionNotes: decisionNotes[invoiceId] || null
      });
      await loadQueue();
    } catch (error) {
      setErrorMessage(error.details?.join(" ") || error.message);
    } finally {
      setActiveInvoiceId(null);
    }
  }

  const rows = items.map((item) => ({
    id: item.invoiceId,
    invoice: <Link to={`/invoices/${item.invoiceId}`}>{item.invoiceNumber || `Invoice #${item.invoiceId}`}</Link>,
    supplier: item.supplierName,
    amount: formatCurrency(item.totalAmount, item.currency),
    workflow: (
      <div>
        <div className="fw-semibold">{item.workflowName}</div>
        <div className="small text-secondary">{item.currentStep.stepName}</div>
      </div>
    ),
    submitted: (
      <div>
        <div>{item.lastSubmittedBy || "Unknown submitter"}</div>
        <div className="small text-secondary">{formatDateTime(item.lastSubmittedAt)}</div>
      </div>
    ),
    status: <StatusBadge status={item.status} />,
    actions: (
      <div className="d-grid gap-2">
        <textarea
          className="form-control form-control-sm"
          onChange={(event) =>
            setDecisionNotes((current) => ({
              ...current,
              [item.invoiceId]: event.target.value
            }))
          }
          placeholder="Optional action note"
          rows="2"
          value={decisionNotes[item.invoiceId] || ""}
        />
        <div className="d-flex flex-wrap gap-2">
          <button
            className="btn btn-sm btn-success"
            disabled={activeInvoiceId === item.invoiceId}
            onClick={() => handleDecision(item.invoiceId, "approve")}
            type="button"
          >
            {activeInvoiceId === item.invoiceId ? "Saving..." : APPROVAL_ACTION_LABELS.approve}
          </button>
          <button
            className="btn btn-sm btn-outline-secondary"
            disabled={activeInvoiceId === item.invoiceId}
            onClick={() => handleDecision(item.invoiceId, "send_back")}
            type="button"
          >
            {APPROVAL_ACTION_LABELS.send_back}
          </button>
          <button
            className="btn btn-sm btn-outline-danger"
            disabled={activeInvoiceId === item.invoiceId}
            onClick={() => handleDecision(item.invoiceId, "reject")}
            type="button"
          >
            {APPROVAL_ACTION_LABELS.reject}
          </button>
        </div>
      </div>
    )
  }));

  return (
    <>
      <PageHeader
        title="Approval Queue"
        description="Review the invoices currently assigned to you in the active approval step."
      />

      {errorMessage ? <div className="alert alert-danger">{errorMessage}</div> : null}

      <div className="row g-3">
        <div className="col-12">
          <DataTableCard
            title="Items awaiting action"
            description={
              isLoading
                ? "Loading your approval queue."
                : "Approve, reject, or send back invoices from the current approval step."
            }
            columns={[
              { key: "invoice", label: "Invoice" },
              { key: "supplier", label: "Supplier" },
              { key: "amount", label: "Amount" },
              { key: "workflow", label: "Workflow / Step" },
              { key: "submitted", label: "Submitted" },
              { key: "status", label: "Status" },
              { key: "actions", label: "Actions" }
            ]}
            emptyMessage={isLoading ? "Loading queue..." : "No invoices are waiting on your approval."}
            rows={rows}
          />
        </div>
      </div>
    </>
  );
}

export default ApprovalQueuePage;
