const { ExperimentRun, StepLog } = require('../models');
const { logStep } = require('../logging/stepLogger');
const { validateExperimentRun, validateStepLog } = require('../validation');

const createSummaryStore = () => ({
  runs: [],
  stepLogs: [],
  attachments: [],
  uploads: [],
  instrumentRecords: [],
});

const findLatestTimestamp = (timestamps) =>
  timestamps
    .filter(Boolean)
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] || null;

const parseJsonBody = async (request) => {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return null;
  }

  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
};

const writeJson = (response, statusCode, payload) => {
  response.statusCode = statusCode;
  response.setHeader('Content-Type', 'application/json');
  response.end(JSON.stringify(payload));
};

const createRunHandler = ({ store = createSummaryStore() } = {}) => {
  const handleRun = async (request, response) => {
    if (request.method !== 'POST') {
      response.statusCode = 405;
      response.end();
      return;
    }

    let payload;
    try {
      payload = await parseJsonBody(request);
    } catch (error) {
      writeJson(response, 400, {
        error: { code: 'invalid_json', message: 'Invalid JSON payload' },
      });
      return;
    }

    if (!payload) {
      writeJson(response, 400, {
        error: { code: 'missing_payload', message: 'Run payload is required' },
      });
      return;
    }

    const run = new ExperimentRun(payload);
    const errors = validateExperimentRun(run, payload.plan || {});
    if (errors.length > 0) {
      writeJson(response, 400, {
        error: { code: 'validation_failed', message: 'Run validation failed', details: errors },
      });
      return;
    }

    const existingIndex = store.runs.findIndex((entry) => entry.id === run.id);
    if (existingIndex >= 0) {
      store.runs.splice(existingIndex, 1, run);
    } else {
      store.runs.push(run);
    }

    writeJson(response, 200, { run });
  };

  return { handleRun, store };
};

const extractRunIdFromUrl = (requestUrl) => {
  const match = requestUrl.match(/^\/api\/runs\/([^/]+)\/steps$/);
  return match ? match[1] : null;
};

const createStepLogHandler = ({ store = createSummaryStore(), logger = console } = {}) => {
  const handleStepLog = async (request, response) => {
    if (request.method !== 'POST') {
      response.statusCode = 405;
      response.end();
      return;
    }

    let payload;
    try {
      payload = await parseJsonBody(request);
    } catch (error) {
      writeJson(response, 400, {
        error: { code: 'invalid_json', message: 'Invalid JSON payload' },
      });
      return;
    }

    if (!payload) {
      writeJson(response, 400, {
        error: { code: 'missing_payload', message: 'StepLog payload is required' },
      });
      return;
    }

    const requestUrl = new URL(request.url || '', 'http://localhost');
    if (!payload.runId) {
      payload.runId = extractRunIdFromUrl(requestUrl.pathname);
    }

    const stepLog = new StepLog(payload);
    const errors = validateStepLog(stepLog);
    if (errors.length > 0) {
      writeJson(response, 400, {
        error: {
          code: 'validation_failed',
          message: 'StepLog validation failed',
          details: errors,
        },
      });
      return;
    }

    store.stepLogs.push(stepLog);
    logStep(
      {
        stepId: stepLog.stepId,
        stepName: stepLog.stepName,
        status: stepLog.status,
        timestamp: stepLog.timestamp,
        details: { runId: stepLog.runId },
      },
      logger,
    );

    writeJson(response, 200, { stepLog });
  };

  return { handleStepLog, store };
};

const createSummaryHandler = ({ store = createSummaryStore() } = {}) => {
  const handleSummary = (request, response) => {
    if (request.method !== 'GET') {
      response.statusCode = 405;
      response.end();
      return;
    }

    const requestUrl = new URL(request.url || '', 'http://localhost');
    const runId = requestUrl.searchParams.get('runId');
    if (!runId) {
      writeJson(response, 400, {
        error: { code: 'missing_run_id', message: 'runId query parameter is required' },
      });
      return;
    }

    const run = store.runs.find((entry) => entry.id === runId);
    if (!run) {
      writeJson(response, 404, {
        error: { code: 'run_not_found', message: 'Run not found' },
      });
      return;
    }

    const stepLogs = store.stepLogs
      .filter((entry) => entry.runId === runId)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    const attachments = store.attachments
      .filter((entry) => entry.runId === runId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    const latestTimestamp = findLatestTimestamp([
      run.finishedAt,
      run.startedAt,
      ...stepLogs.map((entry) => entry.timestamp),
      ...attachments.map((entry) => entry.createdAt),
    ]);

    writeJson(response, 200, {
      run,
      stepLogs,
      attachments,
      counts: {
        stepLogs: stepLogs.length,
        attachments: attachments.length,
      },
      status: run.status,
      lastUpdatedAt: latestTimestamp,
    });
  };

  return { handleSummary, store };
};

module.exports = {
  createSummaryStore,
  createRunHandler,
  createStepLogHandler,
  createSummaryHandler,
};
