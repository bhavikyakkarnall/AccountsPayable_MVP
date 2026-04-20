const { hashPassword } = require("../src/utils/passwords");

async function main() {
  const password = process.argv[2];

  if (!password) {
    throw new Error("Usage: node scripts/hash-password.js <password>");
  }

  const passwordHash = await hashPassword(password);
  console.log(passwordHash);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
