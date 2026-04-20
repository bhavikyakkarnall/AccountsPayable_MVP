function ReportFilters({
  filters,
  meta,
  onChange,
  onApply,
  onReset,
  isLoading = false,
  statusOptions = []
}) {
  return (
    <div className="card border-0 shadow-sm mb-4">
      <div className="card-body">
        <div className="d-flex flex-column flex-lg-row justify-content-between gap-3 mb-3">
          <div>
            <h2 className="h5 mb-1">Filters</h2>
            <p className="text-secondary mb-0">Narrow the dashboard to the suppliers, owners, and dates you care about.</p>
          </div>
          <div className="d-flex gap-2">
            <button className="btn btn-outline-secondary" onClick={onReset} type="button">
              Reset
            </button>
            <button className="btn btn-primary" disabled={isLoading} onClick={onApply} type="button">
              {isLoading ? "Refreshing..." : "Apply filters"}
            </button>
          </div>
        </div>

        <div className="row g-3">
          <div className="col-12 col-xl-3">
            <label className="form-label">Search</label>
            <input
              className="form-control"
              name="search"
              onChange={onChange}
              placeholder="Invoice number or supplier"
              value={filters.search}
            />
          </div>
          <div className="col-12 col-md-6 col-xl-3">
            <label className="form-label">Supplier</label>
            <select className="form-select" name="supplierId" onChange={onChange} value={filters.supplierId}>
              <option value="">All suppliers</option>
              {meta.suppliers.map((supplier) => (
                <option key={supplier.supplierId} value={supplier.supplierId}>
                  {supplier.supplierName}
                </option>
              ))}
            </select>
          </div>
          <div className="col-12 col-md-6 col-xl-3">
            <label className="form-label">Assigned user</label>
            <select
              className="form-select"
              name="assignedUserId"
              onChange={onChange}
              value={filters.assignedUserId}
            >
              <option value="">All owners</option>
              {meta.users.map((user) => (
                <option key={user.userId} value={user.userId}>
                  {user.fullName || user.email}
                </option>
              ))}
            </select>
          </div>
          <div className="col-12 col-md-6 col-xl-3">
            <label className="form-label">Status</label>
            <select className="form-select" name="status" onChange={onChange} value={filters.status}>
              <option value="">All statuses</option>
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="col-12 col-md-4 col-xl-2">
            <label className="form-label">Currency</label>
            <select className="form-select" name="currency" onChange={onChange} value={filters.currency}>
              <option value="">All currencies</option>
              {meta.currencies.map((currency) => (
                <option key={currency} value={currency}>
                  {currency}
                </option>
              ))}
            </select>
          </div>
          <div className="col-12 col-md-4 col-xl-2">
            <label className="form-label">From</label>
            <input className="form-control" name="dateFrom" onChange={onChange} type="date" value={filters.dateFrom} />
          </div>
          <div className="col-12 col-md-4 col-xl-2">
            <label className="form-label">To</label>
            <input className="form-control" name="dateTo" onChange={onChange} type="date" value={filters.dateTo} />
          </div>
          <div className="col-12 col-xl-6 d-flex flex-wrap gap-3 align-items-end">
            <div className="form-check">
              <input
                checked={filters.overdueOnly}
                className="form-check-input"
                id="overdueOnly"
                name="overdueOnly"
                onChange={onChange}
                type="checkbox"
              />
              <label className="form-check-label" htmlFor="overdueOnly">
                Overdue invoices only
              </label>
            </div>
            <div className="form-check">
              <input
                checked={filters.onHoldOnly}
                className="form-check-input"
                id="onHoldOnly"
                name="onHoldOnly"
                onChange={onChange}
                type="checkbox"
              />
              <label className="form-check-label" htmlFor="onHoldOnly">
                On hold only
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ReportFilters;
