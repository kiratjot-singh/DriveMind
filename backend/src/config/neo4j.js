const neo4j = require("neo4j-driver");
const { createModuleLogger } = require("./logger");

const log = createModuleLogger("neo4j");

let driver = null;

const connectNeo4j = async () => {
  const uri = process.env.NEO4J_URI;
  const username = process.env.NEO4J_USERNAME;
  const password = process.env.NEO4J_PASSWORD;

  if (!uri || !username || !password) {
    log.warn("Neo4j config not found — graph database connection skipped");
    return null;
  }

  try {
    driver = neo4j.driver(uri, neo4j.auth.basic(username, password));

    // Verify the connection actually works
    await driver.verifyConnectivity();
    log.info({ uri }, "Neo4j driver initialized and verified");

    return driver;
  } catch (error) {
    log.error(
      { error: error.message, uri },
      "Neo4j connection verification failed — running in degraded mode"
    );
    // Keep the driver instance; it may reconnect later
    return driver;
  }
};

const getNeo4jDriver = () => driver;

module.exports = {
  connectNeo4j,
  getNeo4jDriver,
};