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
  fetchReportMeta,
  fetchReportsOverview,
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
    amount: formatCurrency(invoice.total, invoice.currency),
    status: <StatusBadge status={invoice.status} />
  }));
}

function ReportsPage() {
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
    statusBreakdown: [],
    queues: {
      overdue: [],
      approvedUnpaid: []
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
        fetchReportsOverview(activeFilters)
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

  const supplierChartItems = report.supplierSpendSummary.slice(0, 8).map((supplier) => ({
    id: supplier.supplierId,
    label: supplier.supplierName,
    subtitle: `${supplier.invoiceCount} invoices`,
    value: supplier.totalAmount
  }));

  const supplierRows = report.supplierSpendSummary.map((supplier) => ({
    id: supplier.supplierId,
    supplier: supplier.supplierName,
    invoices: supplier.invoiceCount,
    total: formatCurrency(supplier.totalAmount),
    approvedUnpaid: formatCurrency(supplier.approvedUnpaidAmount),
    overdue: supplier.overdueCount
  }));

  const statusRows = report.statusBreakdown.map((item) => ({
    id: item.status,
    status: <StatusBadge status={item.status} />,
    invoices: item.invoiceCount,
    total: formatCurrency(item.totalAmount)
  }));

  return (
    <>
      <PageHeader
        title="Reports"
        description="Track invoice volume, supplier concentration, and payable exposure across the AP workflow."
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
        <div className="col-12 col-md-6 col-xl-3">
          <SummaryCard
            subtitle={`${report.summary.totalInvoices} invoices in scope`}
            title="Filtered spend"
            value={formatCompactCurrency(report.summary.totalAmount)}
          />
        </div>
        <div className="col-12 col-md-6 col-xl-3">
          <SummaryCard
            subtitle={formatCompactCurrency(report.summary.pendingApproval.totalAmount)}
            title="Pending approval"
            tone="info"
            value={report.summary.pendingApproval.count}
          />
        </div>
        <div className="col-12 col-md-6 col-xl-3">
          <SummaryCard
            subtitle={formatCompactCurrency(report.summary.approvedUnpaid.totalAmount)}
            title="Approved unpaid"
            tone="success"
            value={report.summary.approvedUnpaid.count}
          />
        </div>
        <div className="col-12 col-md-6 col-xl-3">
          <SummaryCard
            subtitle={formatCompactCurrency(report.summary.overdue.totalAmount)}
            title="Overdue"
            tone="danger"
            value={report.summary.overdue.count}
          />
        </div>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-12 col-xl-7">
          <VerticalBarChartCard
            description="Monthly invoice totals across the current filtered set."
            emptyMessage={isLoading ? "Loading monthly totals..." : "No monthly totals found."}
            formatValue={(value) => formatCompactCurrency(value)}
            items={monthlyChartItems}
            title="Monthly invoice totals"
          />
        </div>
        <div className="col-12 col-xl-5">
          <HorizontalBarListCard
            description="Suppliers with the largest share of invoice value."
            emptyMessage={isLoading ? "Loading supplier spend..." : "No supplier spend found."}
            formatValue={(value) => formatCompactCurrency(value)}
            items={supplierChartItems}
            title="Supplier spend summary"
          />
        </div>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-12 col-xl-7">
          <DataTableCard
            columns={[
              { key: "supplier", label: "Supplier" },
              { key: "invoices", label: "Invoices" },
              { key: "total", label: "Total spend" },
              { key: "approvedUnpaid", label: "Approved unpaid" },
              { key: "overdue", label: "Overdue invoices" }
            ]}
            description="A practical supplier summary for review meetings and payment planning."
            emptyMessage={isLoading ? "Loading suppliers..." : "No supplier rows found."}
            rows={supplierRows}
            title="Supplier spend detail"
          />
        </div>
        <div className="col-12 col-xl-5">
          <DataTableCard
            columns={[
              { key: "status", label: "Status" },
              { key: "invoices", label: "Invoices" },
              { key: "total", label: "Total amount" }
            ]}
            description="Invoice mix by workflow status."
            emptyMessage={isLoading ? "Loading status breakdown..." : "No status breakdown found."}
            rows={statusRows}
            title="Status breakdown"
          />
        </div>
      </div>

      <div className="row g-3">
        <div className="col-12 col-xl-6">
          <DataTableCard
            columns={[
              { key: "invoice", label: "Invoice" },
              { key: "supplier", label: "Supplier" },
              { key: "dueDate", label: "Due date" },
              { key: "amount", label: "Amount" },
              { key: "status", label: "Status" }
            ]}
            description="The invoices most likely to need payment or escalation first."
            emptyMessage={isLoading ? "Loading overdue invoices..." : "No overdue invoices found."}
            rows={queueRows(report.queues.overdue)}
            title="Overdue invoices"
          />
        </div>
        <div className="col-12 col-xl-6">
          <DataTableCard
            columns={[
              { key: "invoice", label: "Invoice" },
              { key: "supplier", label: "Supplier" },
              { key: "dueDate", label: "Due date" },
              { key: "amount", label: "Amount" },
              { key: "status", label: "Status" }
            ]}
            description="Approved invoices still sitting outside the payment run."
            emptyMessage={isLoading ? "Loading approved invoices..." : "No approved unpaid invoices found."}
            rows={queueRows(report.queues.approvedUnpaid)}
            title="Approved but unpaid"
          />
        </div>
      </div>
    </>
  );
}

export default ReportsPage;
