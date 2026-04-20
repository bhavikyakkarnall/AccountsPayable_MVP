const session = require("express-session");
const MySQLStoreFactory = require("express-mysql-session");

const { env } = require("./env");

function createSessionMiddleware() {
  let store;

  if (env.session.store === "mysql") {
    const MySQLStore = MySQLStoreFactory(session);

    // Persist sessions in MySQL so authentication survives restarts.
    store = new MySQLStore({
      host: env.db.host,
      port: env.db.port,
      user: env.db.user,
      password: env.db.password,
      database: env.db.name,
      createDatabaseTable: true
    });
  }

  return session({
    name: env.session.name,
    secret: env.session.secret,
    resave: env.session.resave,
    saveUninitialized: env.session.saveUninitialized,
    store,
    cookie: {
      secure: env.session.cookieSecure,
      httpOnly: env.session.cookieHttpOnly,
      sameSite: env.session.cookieSameSite,
      maxAge: env.session.cookieMaxAgeMs
    }
  });
}

module.exports = {
  createSessionMiddleware
};
