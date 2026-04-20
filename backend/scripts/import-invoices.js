const { importInvoicesFromEmailInbox } = require("../src/services/email/emailImport.service");

async function main() {
  const summary = await importInvoicesFromEmailInbox();

  console.log("Email import completed.");
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error("Email import failed.");
  console.error(error);
  process.exitCode = 1;
});
