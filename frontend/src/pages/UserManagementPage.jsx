import DataTableCard from "../components/DataTableCard";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";

const rows = [
  {
    id: "u1",
    name: "Taylor Admin",
    role: "Administrator",
    email: "admin@ap.local",
    status: <StatusBadge status="Approved" />
  },
  {
    id: "u2",
    name: "Jordan Approver",
    role: "Approver",
    email: "approver@ap.local",
    status: <StatusBadge status="Approved" />
  },
  {
    id: "u3",
    name: "Casey AP Clerk",
    role: "AP Clerk",
    email: "clerk@ap.local",
    status: <StatusBadge status="Pending" />
  }
];

function UserManagementPage() {
  return (
    <>
      <PageHeader
        title="User Management"
        description="Manage user access, role assignment, and account status."
        actions={<button className="btn btn-primary">Invite user</button>}
      />

      <DataTableCard
        title="Application users"
        description="Placeholder user directory for future admin controls."
        columns={[
          { key: "name", label: "Name" },
          { key: "role", label: "Role" },
          { key: "email", label: "Email" },
          { key: "status", label: "Status" }
        ]}
        rows={rows}
      />
    </>
  );
}

export default UserManagementPage;
