import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import DataTableCard from "../components/DataTableCard";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import {
  createEmptyInvoiceForm,
  createInvoice,
  EXTRACTION_CONFIDENCE_LABELS,
  fetchInvoiceMeta,
  fetchInvoices,
  INVOICE_STATUSES,
  STATUS_LABELS,
  toInvoicePayload
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

function toneForExtractionConfidence(confidence) {
  if (confidence === "high") {
    return "success";
  }

  if (confidence === "medium") {
    return "info";
  }

  return "warning";
}

function InvoiceInboxPage() {
  const [filters, setFilters] = useState({
    search: "",
    status: "",
    supplierId: "",
    assignedUserId: "",
    duplicateFlag: "",
    onHold: ""
  });
  const [meta, setMeta] = useState({ suppliers: [], users: [] });
  const [invoices, setInvoices] = useState([]);
  const [createForm, setCreateForm] = useState(createEmptyInvoiceForm());
  const [isCreateVisible, setIsCreateVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [submitError, setSubmitError] = useState("");

  async function loadPageData(activeFilters = filters) {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const [invoiceRows, metaResponse] = await Promise.all([
        fetchInvoices(activeFilters),
        fetchInvoiceMeta()
      ]);

      setInvoices(invoiceRows);
      setMeta(metaResponse);
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadPageData();
  }, []);

  function handleFilterChange(event) {
    const { name, value } = event.target;
    setFilters((current) => ({ ...current, [name]: value }));
  }

  async function handleApplyFilters(event) {
    event.preventDefault();
    await loadPageData(filters);
  }

  async function handleResetFilters() {
    const nextFilters = {
      search: "",
      status: "",
      supplierId: "",
      assignedUserId: "",
      duplicateFlag: "",
      onHold: ""
    };

    setFilters(nextFilters);
    await loadPageData(nextFilters);
  }

  function handleCreateFormChange(event) {
    const { name, value, type, checked } = event.target;
    setCreateForm((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value
    }));
  }

  function handleCreateSupplierChange(event) {
    const nextSupplierId = event.target.value;
    const supplier = meta.suppliers.find((item) => String(item.supplierId) === nextSupplierId);

    setCreateForm((current) => ({
      ...current,
      supplierId: nextSupplierId,
      currency: supplier?.defaultCurrency || current.currency
    }));
  }

  async function handleCreateInvoice(event) {
    event.preventDefault();
    setIsSubmitting(true);
    setSubmitError("");

    try {
      await createInvoice(toInvoicePayload(createForm));
      setCreateForm(createEmptyInvoiceForm());
      setIsCreateVisible(false);
      await loadPageData(filters);
    } catch (error) {
      setSubmitError(error.details?.join(" ") || error.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  const rows = invoices.map((invoice) => ({
    id: invoice.invoiceId,
    invoice: <Link to={`/invoices/${invoice.invoiceId}`}>{invoice.invoiceNumber || `Invoice #${invoice.invoiceId}`}</Link>,
    supplier: invoice.supplierName,
    invoiceDate: invoice.invoiceDate || "Not set",
    dueDate: invoice.dueDate || "Not set",
    amount: formatCurrency(invoice.total, invoice.currency),
    extraction: invoice.extractionConfidence ? (
      <span className={`badge text-bg-${toneForExtractionConfidence(invoice.extractionConfidence)}`}>
        {EXTRACTION_CONFIDENCE_LABELS[invoice.extractionConfidence] || invoice.extractionConfidence}
      </span>
    ) : (
      <span className="text-secondary">Not started</span>
    ),
    assigned: invoice.assignedUserName || "Unassigned",
    flags: (
      <div className="d-flex flex-wrap gap-2">
        {invoice.duplicateFlag ? <span className="badge text-bg-danger">Duplicate</span> : null}
        {invoice.holdReason ? <span className="badge text-bg-dark">On hold</span> : null}
        {!invoice.duplicateFlag && !invoice.holdReason ? (
          <span className="text-secondary">None</span>
        ) : null}
      </div>
    ),
    status: <StatusBadge status={invoice.status} />
  }));

  return (
    <>
      <PageHeader
        title="Invoice Inbox"
        description="Create, triage, and review invoices before they move through approval."
        actions={
          <button
            className="btn btn-primary"
            onClick={() => {
              setIsCreateVisible((current) => !current);
              setSubmitError("");
            }}
            type="button"
          >
            {isCreateVisible ? "Close form" : "Create invoice"}
          </button>
        }
      />

      {errorMessage ? <div className="alert alert-danger">{errorMessage}</div> : null}

      {isCreateVisible ? (
        <div className="card border-0 shadow-sm mb-3">
          <div className="card-body">
            <div className="mb-3">
              <h2 className="h5 mb-1">New invoice</h2>
              <p className="text-secondary mb-0">Capture the extracted fields and route ownership.</p>
            </div>
            {submitError ? <div className="alert alert-danger">{submitError}</div> : null}
            <form className="row g-3" onSubmit={handleCreateInvoice}>
              <div className="col-12 col-md-6">
                <label className="form-label">Supplier</label>
                <select
                  className="form-select"
                  name="supplierId"
                  onChange={handleCreateSupplierChange}
                  value={createForm.supplierId}
                >
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
                  onChange={handleCreateFormChange}
                  value={createForm.assignedUserId}
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
                  onChange={handleCreateFormChange}
                  value={createForm.invoiceNumber}
                />
              </div>
              <div className="col-12 col-md-4">
                <label className="form-label">Invoice date</label>
                <input
                  className="form-control"
                  name="invoiceDate"
                  onChange={handleCreateFormChange}
                  type="date"
                  value={createForm.invoiceDate}
                />
              </div>
              <div className="col-12 col-md-4">
                <label className="form-label">Due date</label>
                <input
                  className="form-control"
                  name="dueDate"
                  onChange={handleCreateFormChange}
                  type="date"
                  value={createForm.dueDate}
                />
              </div>
              <div className="col-12 col-md-3">
                <label className="form-label">Subtotal</label>
                <input
                  className="form-control"
                  inputMode="decimal"
                  name="subtotal"
                  onChange={handleCreateFormChange}
                  value={createForm.subtotal}
                />
              </div>
              <div className="col-12 col-md-3">
                <label className="form-label">Tax</label>
                <input
                  className="form-control"
                  inputMode="decimal"
                  name="tax"
                  onChange={handleCreateFormChange}
                  value={createForm.tax}
                />
              </div>
              <div className="col-12 col-md-3">
                <label className="form-label">Total</label>
                <input
                  className="form-control"
                  inputMode="decimal"
                  name="total"
                  onChange={handleCreateFormChange}
                  value={createForm.total}
                />
              </div>
              <div className="col-12 col-md-3">
                <label className="form-label">Currency</label>
                <input
                  className="form-control"
                  maxLength="3"
                  name="currency"
                  onChange={handleCreateFormChange}
                  value={createForm.currency}
                />
              </div>
              <div className="col-12 col-md-6">
                <label className="form-label">Status</label>
                <select
                  className="form-select"
                  name="status"
                  onChange={handleCreateFormChange}
                  value={createForm.status}
                >
                  {INVOICE_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {STATUS_LABELS[status]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-12 col-md-6">
                <label className="form-label">External PO number</label>
                <input
                  className="form-control"
                  name="externalPoNumber"
                  onChange={handleCreateFormChange}
                  value={createForm.externalPoNumber}
                />
              </div>
              <div className="col-12">
                <div className="form-check">
                  <input
                    checked={createForm.externalPoVerified}
                    className="form-check-input"
                    id="createExternalPoVerified"
                    name="externalPoVerified"
                    onChange={handleCreateFormChange}
                    type="checkbox"
                  />
                  <label className="form-check-label" htmlFor="createExternalPoVerified">
                    External PO verified
                  </label>
                </div>
              </div>
              <div className="col-12 d-flex gap-2 justify-content-end">
                <button
                  className="btn btn-outline-secondary"
                  onClick={() => setCreateForm(createEmptyInvoiceForm())}
                  type="button"
                >
                  Reset
                </button>
                <button className="btn btn-primary" disabled={isSubmitting} type="submit">
                  {isSubmitting ? "Creating..." : "Create invoice"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <form className="row g-3 mb-3" onSubmit={handleApplyFilters}>
        <div className="col-12 col-md-4">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <label className="form-label">Search</label>
              <input
                className="form-control"
                name="search"
                onChange={handleFilterChange}
                placeholder="Invoice number or supplier"
                value={filters.search}
              />
            </div>
          </div>
        </div>
        <div className="col-12 col-md-4">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <label className="form-label">Status</label>
              <select
                className="form-select"
                name="status"
                onChange={handleFilterChange}
                value={filters.status}
              >
                <option value="">All statuses</option>
                {INVOICE_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <div className="col-12 col-md-4">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <label className="form-label">Supplier</label>
              <select
                className="form-select"
                name="supplierId"
                onChange={handleFilterChange}
                value={filters.supplierId}
              >
                <option value="">All suppliers</option>
                {meta.suppliers.map((supplier) => (
                  <option key={supplier.supplierId} value={supplier.supplierId}>
                    {supplier.supplierName}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <div className="col-12 col-md-4">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <label className="form-label">Assigned user</label>
              <select
                className="form-select"
                name="assignedUserId"
                onChange={handleFilterChange}
                value={filters.assignedUserId}
              >
                <option value="">Anyone</option>
                {meta.users.map((user) => (
                  <option key={user.userId} value={user.userId}>
                    {user.fullName || user.email}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <div className="col-12 col-md-4">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <label className="form-label">Duplicate</label>
              <select
                className="form-select"
                name="duplicateFlag"
                onChange={handleFilterChange}
                value={filters.duplicateFlag}
              >
                <option value="">All</option>
                <option value="true">Duplicates only</option>
                <option value="false">Exclude duplicates</option>
              </select>
            </div>
          </div>
        </div>
        <div className="col-12 col-md-4">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <label className="form-label">Hold state</label>
              <select
                className="form-select"
                name="onHold"
                onChange={handleFilterChange}
                value={filters.onHold}
              >
                <option value="">All</option>
                <option value="true">On hold</option>
                <option value="false">Not on hold</option>
              </select>
            </div>
          </div>
        </div>
        <div className="col-12 d-flex gap-2 justify-content-end">
          <button className="btn btn-outline-secondary" onClick={handleResetFilters} type="button">
            Reset filters
          </button>
          <button className="btn btn-primary" type="submit">
            Apply filters
          </button>
        </div>
      </form>

      <DataTableCard
        columns={[
          { key: "invoice", label: "Invoice" },
          { key: "supplier", label: "Supplier" },
          { key: "invoiceDate", label: "Invoice date" },
          { key: "dueDate", label: "Due date" },
          { key: "amount", label: "Total" },
          { key: "assigned", label: "Assigned user" },
          { key: "flags", label: "Flags" },
          { key: "status", label: "Status" }
        ]}
        description={
          isLoading
            ? "Loading invoices..."
            : "Open an invoice to edit extracted data, review comments, and manage status."
        }
        emptyMessage={isLoading ? "Loading invoices..." : "No invoices match the selected filters."}
        rows={rows}
        title="Invoices"
      />
    </>
  );
}

export default InvoiceInboxPage;
