const app = require("./app");
const { env } = require("./config/env");
const { testDatabaseConnection } = require("./config/database");

async function startServer() {
  try {
    await testDatabaseConnection();

    app.listen(env.port, () => {
      console.log(`Accounts Payable backend listening on port ${env.port}`);
    });
  } catch (error) {
    console.error("Failed to start backend:", error);
    process.exit(1);
  }
}

startServer();
