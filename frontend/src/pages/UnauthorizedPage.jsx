import { Link } from "react-router-dom";

function UnauthorizedPage() {
  return (
    <div className="card border-0 shadow-sm">
      <div className="card-body p-5 text-center">
        <h1 className="h3 mb-3">Access restricted</h1>
        <p className="text-secondary mb-4">
          Your assigned role does not have access to this area of the Accounts Payable app.
        </p>
        <Link to="/dashboard" className="btn btn-primary">
          Return to dashboard
        </Link>
      </div>
    </div>
  );
}

export default UnauthorizedPage;
