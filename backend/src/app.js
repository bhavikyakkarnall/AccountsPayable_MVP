const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const { env } = require("./config/env");
const { createSessionMiddleware } = require("./config/session");
const apiRoutes = require("./routes");
const notFound = require("./middleware/notFound");
const errorHandler = require("./middleware/errorHandler");

const app = express();

app.disable("x-powered-by");
app.use(helmet());
app.use(
  cors({
    origin: env.appOrigin,
    credentials: true
  })
);
app.use(morgan(env.nodeEnv === "production" ? "combined" : "dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(createSessionMiddleware());

app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Accounts Payable backend is healthy."
  });
});

// Central API mounting point so the version prefix is managed in one place.
app.use(env.apiPrefix, apiRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
