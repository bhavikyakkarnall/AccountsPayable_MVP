const ApiError = require("../utils/ApiError");

function authorizeRoles(...allowedRoles) {
  return function roleAuthorization(req, res, next) {
    if (!req.user) {
      return next(new ApiError(401, "Authentication required."));
    }

    const roles = req.user?.roles || [];
    const hasAccess = allowedRoles.some((role) => roles.includes(role));

    if (!hasAccess) {
      return next(new ApiError(403, "You do not have access to this resource."));
    }

    next();
  };
}

module.exports = authorizeRoles;
