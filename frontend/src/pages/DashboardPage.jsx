import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import DataTableCard from "../components/DataTableCard";
import HorizontalBarListCard from "../components/HorizontalBarListCard";
import PageHeader from "../components/PageHeader";
import ReportFilters from "../components/ReportFilters";
import StatusBadge from "../components/StatusBadge";
import SummaryCard from "../components/SummaryCard";
import VerticalBarChartCard from "../components/VerticalBarChartCard";
import { INVOICE_STATUSES, STATUS_LABELS } from "../lib/invoices";
import {
  createEmptyReportFilters,
  fetchDashboardReport,
  fetchReportMeta,
  formatCompactCurrency,
  formatCurrency,
  formatDate
} from "../lib/reports";

const statusOptions = INVOICE_STATUSES.map((status) => ({
  value: status,
  label: STATUS_LABELS[status] || status
}));

function queueRows(items = []) {
  return items.map((invoice) => ({
    id: invoice.invoiceId,
    invoice: <Link to={`/invoices/${invoice.invoiceId}`}>{invoice.invoiceNumber || `Invoice #${invoice.invoiceId}`}</Link>,
    supplier: invoice.supplierName,
    dueDate: invoice.dueDate ? formatDate(invoice.dueDate) : "Not set",
    owner: invoice.assignedUserName || "Unassigned",
    amount: formatCurrency(invoice.total, invoice.currency),
    status: <StatusBadge status={invoice.status} />
  }));
}

function DashboardPage() {
  const [filters, setFilters] = useState(createEmptyReportFilters());
  const [meta, setMeta] = useState({ suppliers: [], users: [], currencies: [] });
  const [report, setReport] = useState({
    summary: {
      totalInvoices: 0,
      totalAmount: 0,
      needingReview: { count: 0, totalAmount: 0 },
      pendingApproval: { count: 0, totalAmount: 0 },
      approvedUnpaid: { count: 0, totalAmount: 0 },
      overdue: { count: 0, totalAmount: 0 },
      onHold: { count: 0, totalAmount: 0 }
    },
    monthlyTotals: [],
    supplierSpendSummary: [],
    queues: {
      needingReview: [],
      pendingApproval: [],
      approvedUnpaid: [],
      overdue: [],
      onHold: []
    }
  });
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  async function loadData(activeFilters = filters) {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const [metaResponse, reportResponse] = await Promise.all([
        fetchReportMeta(),
        fetchDashboardReport(activeFilters)
      ]);

      setMeta(metaResponse);
      setReport(reportResponse);
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function handleFilterChange(event) {
    const { name, value, type, checked } = event.target;
    setFilters((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value
    }));
  }

  async function handleApplyFilters() {
    await loadData(filters);
  }

  async function handleResetFilters() {
    const nextFilters = createEmptyReportFilters();
    setFilters(nextFilters);
    await loadData(nextFilters);
  }

  const monthlyChartItems = report.monthlyTotals.map((month) => ({
    id: month.monthStart,
    label: month.monthLabel,
    subtitle: `${month.invoiceCount} invoices`,
    value: month.totalAmount
  }));
  const supplierChartItems = report.supplierSpendSummary.map((supplier) => ({
    id: supplier.supplierId,
    label: supplier.supplierName,
    subtitle: `${supplier.invoiceCount} invoices`,
    value: supplier.totalAmount
  }));

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="A live snapshot of the AP queues, cash exposure, and supplier concentration."
      />

      {errorMessage ? <div className="alert alert-danger">{errorMessage}</div> : null}

      <ReportFilters
        filters={filters}
        isLoading={isLoading}
        meta={meta}
        onApply={handleApplyFilters}
        onChange={handleFilterChange}
        onReset={handleResetFilters}
        statusOptions={statusOptions}
      />

      <div className="row g-3 mb-4">
        <div className="col-12 col-md-6 col-xl-2">
          <SummaryCard
            subtitle={formatCompactCurrency(report.summary.needingReview.totalAmount)}
            title="Needs review"
            tone="warning"
            value={report.summary.needingReview.count}
          />
        </div>
        <div className="col-12 col-md-6 col-xl-2">
          <SummaryCard
            subtitle={formatCompactCurrency(report.summary.pendingApproval.totalAmount)}
            title="Pending approval"
            tone="info"
            value={report.summary.pendingApproval.count}
          />
        </div>
        <div className="col-12 col-md-6 col-xl-2">
          <SummaryCard
            subtitle={formatCompactCurrency(report.summary.approvedUnpaid.totalAmount)}
            title="Approved unpaid"
            tone="success"
            value={report.summary.approvedUnpaid.count}
          />
        </div>
        <div className="col-12 col-md-6 col-xl-2">
          <SummaryCard
            subtitle={formatCompactCurrency(report.summary.overdue.totalAmount)}
            title="Overdue"
            tone="danger"
            value={report.summary.overdue.count}
          />
        </div>
        <div className="col-12 col-md-6 col-xl-2">
          <SummaryCard
            subtitle={formatCompactCurrency(report.summary.onHold.totalAmount)}
            title="On hold"
            tone="dark"
            value={report.summary.onHold.count}
          />
        </div>
        <div className="col-12 col-md-6 col-xl-2">
          <SummaryCard
            subtitle={`${report.summary.totalInvoices} invoices in scope`}
            title="Filtered spend"
            tone="primary"
            value={formatCompactCurrency(report.summary.totalAmount)}
          />
        </div>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-12 col-xl-7">
          <VerticalBarChartCard
            description="Monthly invoice totals for the current filtered view."
            emptyMessage={isLoading ? "Loading monthly totals..." : "No monthly totals found."}
            formatValue={(value) => formatCompactCurrency(value)}
            items={monthlyChartItems}
            title="Monthly invoice totals"
          />
        </div>
        <div className="col-12 col-xl-5">
          <HorizontalBarListCard
            description="Top suppliers by invoice value."
            emptyMessage={isLoading ? "Loading supplier spend..." : "No supplier spend found."}
            formatValue={(value) => formatCompactCurrency(value)}
            items={supplierChartItems}
            title="Supplier spend summary"
          />
        </div>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-12 col-xl-6">
          <DataTableCard
            columns={[
              { key: "invoice", label: "Invoice" },
              { key: "supplier", label: "Supplier" },
              { key: "dueDate", label: "Due date" },
              { key: "owner", label: "Owner" },
              { key: "amount", label: "Amount" },
              { key: "status", label: "Status" }
            ]}
            description="The next invoices that still need coding or review attention."
            emptyMessage={isLoading ? "Loading invoices..." : "No invoices need review."}
            rows={queueRows(report.queues.needingReview)}
            title="Invoices needing review"
          />
        </div>
        <div className="col-12 col-xl-6">
          <DataTableCard
            columns={[
              { key: "invoice", label: "Invoice" },
              { key: "supplier", label: "Supplier" },
              { key: "dueDate", label: "Due date" },
              { key: "owner", label: "Owner" },
              { key: "amount", label: "Amount" },
              { key: "status", label: "Status" }
            ]}
            description="Invoices already overdue and likely to drive the next escalation."
            emptyMessage={isLoading ? "Loading invoices..." : "No overdue invoices found."}
            rows={queueRows(report.queues.overdue)}
            title="Overdue invoices"
          />
        </div>
      </div>

      <div className="row g-3">
        <div className="col-12 col-xl-4">
          <DataTableCard
            columns={[
              { key: "invoice", label: "Invoice" },
              { key: "supplier", label: "Supplier" },
              { key: "amount", label: "Amount" },
              { key: "status", label: "Status" }
            ]}
            description="Invoices waiting on approver action."
            emptyMessage={isLoading ? "Loading invoices..." : "No approvals are waiting."}
            rows={queueRows(report.queues.pendingApproval)}
            title="Pending approval"
          />
        </div>
        <div className="col-12 col-xl-4">
          <DataTableCard
            columns={[
              { key: "invoice", label: "Invoice" },
              { key: "supplier", label: "Supplier" },
              { key: "amount", label: "Amount" },
              { key: "status", label: "Status" }
            ]}
            description="Approved invoices that still need payment processing."
            emptyMessage={isLoading ? "Loading invoices..." : "No approved unpaid invoices found."}
            rows={queueRows(report.queues.approvedUnpaid)}
            title="Approved but unpaid"
          />
        </div>
        <div className="col-12 col-xl-4">
          <DataTableCard
            columns={[
              { key: "invoice", label: "Invoice" },
              { key: "supplier", label: "Supplier" },
              { key: "owner", label: "Owner" },
              { key: "amount", label: "Amount" },
              { key: "status", label: "Status" }
            ]}
            description="Invoices paused because of a hold reason or explicit on-hold status."
            emptyMessage={isLoading ? "Loading invoices..." : "No invoices are on hold."}
            rows={queueRows(report.queues.onHold)}
            title="Invoices on hold"
          />
        </div>
      </div>
    </>
  );
}

export default DashboardPage;
