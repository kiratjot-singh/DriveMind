const neo4j = require("neo4j-driver");
const logger = require("./logger");

let driver = null;

const connectNeo4j = async (retries = 5, delay = 5000) => {
  const uri = process.env.NEO4J_URI;
  const username = process.env.NEO4J_USERNAME;
  const password = process.env.NEO4J_PASSWORD;

  if (!uri || !username || !password) {
    logger.warn("Neo4j config not found. Neo4j connection skipped.");
    return null;
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      driver = neo4j.driver(uri, neo4j.auth.basic(username, password));
      const session = driver.session();
      await session.run("RETURN 1");
      await session.close();
      
      logger.info("Neo4j driver initialized and connectivity verified");
      return driver;
    } catch (error) {
      logger.error(`Neo4j connection attempt ${attempt} failed: ${error.message}`);
      if (driver) {
        await driver.close();
        driver = null;
      }
      if (attempt === retries) {
        logger.error("Max Neo4j connection retries reached. Driver skipped.");
        return null;
      }
      logger.info(`Retrying Neo4j in ${delay / 1000} seconds...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
};

const getNeo4jDriver = () => driver;

module.exports = {
  connectNeo4j,
  getNeo4jDriver,
};