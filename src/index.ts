import app from './app.js';
import { logger } from './utils/logger.js';
import config from './config/nexus.config.js';

const port = config.port;

app.listen(port, () => {
  logger.info(`🚀 NexusCommerce API Server active on port ${port} [${config.env}]`);
  logger.info(`🔗 Base URL: http://localhost:${port}`);
  logger.info(`🩺 Health Check: http://localhost:${port}/healthz`);
});
