const express = require("express");

const authController = require("../controllers/auth/auth.controller");
const requireAuth = require("../middleware/requireAuth");

const router = express.Router();

router.post("/login", authController.login);
router.post("/logout", requireAuth, authController.logout);
router.get("/session", authController.getSession);

module.exports = router;
