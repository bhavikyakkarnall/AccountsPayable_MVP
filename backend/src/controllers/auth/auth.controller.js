const ApiError = require("../../utils/ApiError");
const asyncHandler = require("../../utils/asyncHandler");
const { env } = require("../../config/env");
const authModel = require("../../models/auth/auth.model");
const { verifyPassword } = require("../../utils/passwords");

function buildSessionUser(user, roles) {
  return {
    userId: user.userId,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    fullName: `${user.firstName} ${user.lastName}`.trim(),
    roles
  };
}

function regenerateSession(req) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

function saveSession(req) {
  return new Promise((resolve, reject) => {
    req.session.save((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

function destroySession(req) {
  return new Promise((resolve, reject) => {
    req.session.destroy((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

const login = asyncHandler(async (req, res) => {
  const email = req.body.email?.trim();
  const password = req.body.password;

  if (!email || !password) {
    throw new ApiError(400, "Email and password are required.");
  }

  const user = await authModel.findUserByEmail(email);

  if (!user || !user.isActive) {
    throw new ApiError(401, "Invalid credentials.");
  }

  const passwordMatches = await verifyPassword(password, user.passwordHash);

  if (!passwordMatches) {
    throw new ApiError(401, "Invalid credentials.");
  }

  const roles = await authModel.findUserRoles(user.userId);

  if (roles.length === 0) {
    throw new ApiError(403, "Your account does not have any assigned roles.");
  }

  const sessionUser = buildSessionUser(user, roles);

  await regenerateSession(req);
  req.session.user = sessionUser;
  await saveSession(req);
  await authModel.updateLastLoginAt(user.userId);

  res.status(200).json({
    success: true,
    message: "Login successful.",
    data: sessionUser
  });
});

const logout = asyncHandler(async (req, res) => {
  if (!req.session) {
    res.status(200).json({
      success: true,
      message: "No active session found."
    });
    return;
  }

  await destroySession(req);
  res.clearCookie(env.session.name, {
    secure: env.session.cookieSecure,
    httpOnly: env.session.cookieHttpOnly,
    sameSite: env.session.cookieSameSite
  });
  res.status(200).json({
    success: true,
    message: "Logout successful."
  });
});

const getSession = asyncHandler(async (req, res) => {
  res.status(200).json({
    success: true,
    data: req.session.user || null
  });
});

module.exports = {
  login,
  logout,
  getSession
};
