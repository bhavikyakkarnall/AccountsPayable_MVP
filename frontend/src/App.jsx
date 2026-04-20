import { Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import { APP_ROLES } from "./config/roles";
import AuthLayout from "./layouts/AuthLayout";
import DashboardLayout from "./layouts/DashboardLayout";
import ApprovalQueuePage from "./pages/ApprovalQueuePage";
import DashboardPage from "./pages/DashboardPage";
import InvoiceDetailPage from "./pages/InvoiceDetailPage";
import InvoiceInboxPage from "./pages/InvoiceInboxPage";
import LoginPage from "./pages/LoginPage";
import NotFoundPage from "./pages/NotFoundPage";
import PaymentsPage from "./pages/PaymentsPage";
import ReportsPage from "./pages/ReportsPage";
import SuppliersPage from "./pages/SuppliersPage";
import UnauthorizedPage from "./pages/UnauthorizedPage";
import UserManagementPage from "./pages/UserManagementPage";

function App() {
  return (
    <Routes>
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/unauthorized" element={<UnauthorizedPage />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<DashboardLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route
            element={
              <ProtectedRoute
                allowedRoles={[APP_ROLES.AP_ADMIN, APP_ROLES.AP_PROCESSOR, APP_ROLES.FINANCE_MANAGER]}
              />
            }
          >
            <Route path="/suppliers" element={<SuppliersPage />} />
          </Route>
          <Route element={<ProtectedRoute allowedRoles={[APP_ROLES.AP_ADMIN, APP_ROLES.AP_PROCESSOR]} />}>
            <Route path="/invoice-inbox" element={<InvoiceInboxPage />} />
          </Route>
          <Route
            element={
              <ProtectedRoute
                allowedRoles={[
                  APP_ROLES.AP_ADMIN,
                  APP_ROLES.AP_PROCESSOR,
                  APP_ROLES.APPROVER,
                  APP_ROLES.FINANCE_MANAGER,
                  APP_ROLES.AUDITOR
                ]}
              />
            }
          >
            <Route path="/invoices/:invoiceId" element={<InvoiceDetailPage />} />
          </Route>
          <Route
            element={
              <ProtectedRoute
                allowedRoles={[APP_ROLES.AP_ADMIN, APP_ROLES.APPROVER, APP_ROLES.FINANCE_MANAGER]}
              />
            }
          >
            <Route path="/approval-queue" element={<ApprovalQueuePage />} />
          </Route>
          <Route
            element={
              <ProtectedRoute allowedRoles={[APP_ROLES.AP_ADMIN, APP_ROLES.FINANCE_MANAGER]} />
            }
          >
            <Route path="/payments" element={<PaymentsPage />} />
          </Route>
          <Route
            element={
              <ProtectedRoute
                allowedRoles={[APP_ROLES.AP_ADMIN, APP_ROLES.FINANCE_MANAGER, APP_ROLES.AUDITOR]}
              />
            }
          >
            <Route path="/reports" element={<ReportsPage />} />
          </Route>
          <Route element={<ProtectedRoute allowedRoles={[APP_ROLES.AP_ADMIN]} />}>
            <Route path="/users" element={<UserManagementPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default App;
