import DataTableCard from "../components/DataTableCard";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";

const supplierRows = [
  { id: "s1", name: "Northern Paper Co.", contact: "ap@northernpaper.com", status: <StatusBadge status="Approved" /> },
  { id: "s2", name: "Metro Office Supplies", contact: "billing@metrooffice.com", status: <StatusBadge status="Pending" /> },
  { id: "s3", name: "Greenlight Logistics", contact: "finance@greenlight.com", status: <StatusBadge status="Approved" /> }
];

function SuppliersPage() {
  return (
    <>
      <PageHeader
        title="Suppliers"
        description="Track supplier onboarding, contacts, and operational status."
        actions={<button className="btn btn-primary">Add supplier</button>}
      />

      <div className="row g-3">
        <div className="col-12 col-lg-4">
          <div className="card border-0 shadow-sm">
            <div className="card-body">
              <h2 className="h5 mb-3">Supplier filters</h2>
              <div className="mb-3">
                <label className="form-label">Search</label>
                <input className="form-control" placeholder="Supplier name or email" />
              </div>
              <div className="mb-3">
                <label className="form-label">Status</label>
                <select className="form-select">
                  <option>All suppliers</option>
                  <option>Approved</option>
                  <option>Pending</option>
                </select>
              </div>
              <button className="btn btn-outline-secondary w-100">Apply filters</button>
            </div>
          </div>
        </div>

        <div className="col-12 col-lg-8">
          <DataTableCard
            title="Supplier directory"
            description="Placeholder table for supplier master data."
            columns={[
              { key: "name", label: "Supplier" },
              { key: "contact", label: "Contact" },
              { key: "status", label: "Status" }
            ]}
            rows={supplierRows}
          />
        </div>
      </div>
    </>
  );
}

export default SuppliersPage;
