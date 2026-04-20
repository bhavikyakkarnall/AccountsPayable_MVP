import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, login } = useAuth();
  const [formState, setFormState] = useState({
    email: "",
    password: ""
  });
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const redirectTo = location.state?.from?.pathname || "/dashboard";

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setErrorMessage("");
    setIsSubmitting(true);

    try {
      await login(formState);
      navigate(redirectTo, { replace: true });
    } catch (error) {
      setErrorMessage(error.message || "Unable to sign in.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="card border-0 shadow-sm">
      <div className="card-body p-4 p-lg-5">
        <div className="text-center mb-4">
          <span className="badge text-bg-primary mb-3">Secure Session Login</span>
          <h1 className="h3 mb-2">Sign in to Accounts Payable</h1>
          <p className="text-secondary mb-0">
            Use your Accounts Payable credentials to access role-specific workflows.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label className="form-label" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              className="form-control"
              type="email"
              autoComplete="username"
              value={formState.email}
              onChange={(event) =>
                setFormState((currentState) => ({
                  ...currentState,
                  email: event.target.value
                }))
              }
              required
            />
          </div>

          <div className="mb-4">
            <label className="form-label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              className="form-control"
              type="password"
              autoComplete="current-password"
              value={formState.password}
              onChange={(event) =>
                setFormState((currentState) => ({
                  ...currentState,
                  password: event.target.value
                }))
              }
              required
            />
          </div>

          {errorMessage ? (
            <div className="alert alert-danger" role="alert">
              {errorMessage}
            </div>
          ) : null}

          <button type="submit" className="btn btn-primary w-100" disabled={isSubmitting}>
            {isSubmitting ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default LoginPage;
