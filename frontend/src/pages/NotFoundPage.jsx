import { Link } from "react-router-dom";

function NotFoundPage() {
  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center px-3">
      <div className="text-center">
        <h1 className="display-6 mb-3">Page not found</h1>
        <p className="text-secondary mb-4">The page you requested does not exist in this scaffold.</p>
        <Link to="/dashboard" className="btn btn-primary">
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}

export default NotFoundPage;
