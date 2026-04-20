import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { getVisibleNavigation, roles } from "../config/navigation";
import { useAuth } from "../context/AuthContext";

function DashboardLayout() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user, roles: userRoles, logout } = useAuth();
  const sections = getVisibleNavigation(userRoles);
  const pageTitle =
    sections.flatMap((section) => section.items).find((item) => pathname.startsWith(item.path))?.label ||
    (pathname.startsWith("/invoices/") ? "Invoice Review" : "Workspace");
  const primaryRole = userRoles[0];

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="dashboard-shell">
      <aside className="sidebar border-end">
        <div className="p-4 border-bottom">
          <span className="text-uppercase small text-secondary fw-semibold">Accounts Payable</span>
          <h1 className="h4 mb-0 mt-2">Admin Portal</h1>
        </div>

        <nav className="p-3">
          {sections.map((section) => (
            <div key={section.title} className="mb-4">
              <p className="sidebar-section-title mb-2">{section.title}</p>
              <div className="nav flex-column gap-1">
                {section.items.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={({ isActive }) =>
                      `nav-link sidebar-link ${isActive ? "active" : ""}`
                    }
                  >
                    <i className={`bi ${item.icon} me-2`} />
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      <div className="main-panel">
        <header className="topbar border-bottom px-4 py-3">
          <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
            <div>
              <p className="text-secondary mb-1 small">Current page</p>
              <h2 className="h5 mb-0">{pageTitle}</h2>
            </div>

            <div className="d-flex flex-column flex-sm-row gap-2 align-items-sm-center">
              <div className="text-end">
                <p className="mb-0 fw-semibold">{user.fullName}</p>
                <p className="mb-0 text-secondary small">{roles[primaryRole] || "Authenticated user"}</p>
              </div>
              <button type="button" className="btn btn-outline-secondary" onClick={handleLogout}>
                Sign out
              </button>
            </div>
          </div>
        </header>

        <main className="p-4">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default DashboardLayout;
