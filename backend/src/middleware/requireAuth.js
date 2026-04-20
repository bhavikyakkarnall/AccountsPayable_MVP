const ApiError = require("../utils/ApiError");

function requireAuth(req, res, next) {
  if (!req.session || !req.session.user) {
    return next(new ApiError(401, "Authentication required."));
  }

  req.user = req.session.user;
  next();
}

module.exports = requireAuth;
