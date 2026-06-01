import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import { createServerConfig } from './config/serverConfig.js';
import { createAgentController } from './controllers/agentController.js';
import { createCallController } from './controllers/callController.js';
import { createHealthController } from './controllers/healthController.js';
import { createOAuthController } from './controllers/oauthController.js';
import { createObservabilityController } from './controllers/observabilityController.js';
import { createObservabilityProfileController } from './controllers/observabilityProfileController.js';
import { createParameterVersionController } from './controllers/parameterVersionController.js';
import { createWebhookController } from './controllers/webhookController.js';
import { createCallAnalysisQueue } from './callAnalysisQueue.js';
import { createApiRouter } from './routes/apiRoutes.js';
import { createDashboardService } from './services/dashboardService.js';
import { createHighLevelService } from './services/highLevelService.js';
import { createErrorHandler } from './utils/http.js';

dotenv.config();

const app = express();
const config = createServerConfig();
const currentDir = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.resolve(currentDir, '..', 'dist');
const highLevelService = createHighLevelService(config.highLevel);
const analysisQueue = createCallAnalysisQueue({
  highLevelToken: config.highLevel.token,
  locationId: config.highLevel.locationId,
  highLevelVersion: config.highLevel.version,
  highLevelBaseUrl: config.highLevel.baseUrl,
  callType: config.highLevel.callType,
  observabilityProfilesFile: config.localDataFile,
  parameterVersionsFile: config.localDataFile,
  analysisResultsFile: config.localDataFile,
  openAiApiKey: config.openAi.apiKey,
  openAiModel: config.openAi.model,
  maxAttempts: config.analysis.maxAttempts,
  retryDelayMs: config.analysis.retryDelayMs
});
const dashboardService = createDashboardService({
  highLevelService,
  localDataFile: config.localDataFile,
  locationId: config.highLevel.locationId,
  useDemoDataWhenEmpty: config.dashboard.useDemoDataWhenEmpty,
  showDeletedAgentCalls: config.dashboard.showDeletedAgentCalls
});

const controllers = {
  health: createHealthController(),
  calls: createCallController({
    analysisQueue,
    highLevelService,
    localDataFile: config.localDataFile,
    defaultLocationId: config.highLevel.locationId
  }),
  agents: createAgentController({ highLevelService }),
  observability: createObservabilityController({ dashboardService }),
  observabilityProfiles: createObservabilityProfileController({
    localDataFile: config.localDataFile
  }),
  parameterVersions: createParameterVersionController({ localDataFile: config.localDataFile }),
  oauth: createOAuthController({ oauthConfig: config.oauth }),
  webhooks: createWebhookController({
    analysisQueue,
    localDataFile: config.localDataFile,
    locationId: config.highLevel.locationId
  })
};

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use('/api', createApiRouter(controllers));

if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));

  app.get(/^\/(?!api\/).*/, (_request, response) => {
    response.sendFile(path.join(distPath, 'index.html'));
  });
}

app.use(createErrorHandler());

app.listen(config.port, () => {
  console.log(`Voice AI Observability backend listening on http://localhost:${config.port}`);
});
