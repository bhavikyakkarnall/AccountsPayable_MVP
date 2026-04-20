import { Outlet } from "react-router-dom";

function AuthLayout() {
  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center auth-shell px-3 py-5">
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-12 col-md-10 col-lg-8 col-xl-6">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
}

export default AuthLayout;
