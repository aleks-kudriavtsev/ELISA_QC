const fs = require('fs/promises');
const path = require('path');

const { ExperimentRun, StepLog } = require('../models');
const { logStep } = require('../logging/stepLogger');
const { buildStandardCurveSummary } = require('../analysis/standardCurve');
const { calculateFactorEffects } = require('../analysis/experimentDesign');
const {
  normalizeControlLabel,
  parseControlRange,
  parseCsvRows,
} = require('../analysis/csvUtils');
const { validateExperimentRun, validateStepLog } = require('../validation');

const defaultStorageRoot = path.resolve(__dirname, '../../../..');
const summarizeLotTypes = (lots) => {
  if (!Array.isArray(lots) || lots.length === 0) {
    return '';
  }
  const types = Array.from(
    lots.reduce((set, lot) => {
      if (lot?.materialType) {
        set.add(lot.materialType);
      }
      return set;
    }, new Set()),
  );
  return types.join(',');
};

const createSummaryStore = () => ({
  runs: [],
  stepLogs: [],
  attachments: [],
  uploads: [],
  instrumentRecords: [],
  experimentDesigns: [],
});

const findLatestTimestamp = (timestamps) =>
  timestamps
    .filter(Boolean)
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] || null;

const buildControlSummary = async ({
  store,
  runId,
  storageRoot = defaultStorageRoot,
}) => {
  const records = store.instrumentRecords.filter((entry) => entry.runId === runId);
  const controlMap = new Map();
  const warnings = [];

  for (const record of records) {
    if (!record.dataPath) {
      continue;
    }
    const absolutePath = path.join(storageRoot, record.dataPath);
    let content;
    try {
      content = await fs.readFile(absolutePath, 'utf8');
    } catch (error) {
      continue;
    }

    const { rows } = parseCsvRows(content);
    rows.forEach((row) => {
      const sampleId = row.SampleID || row.sampleId || '';
      if (!/control/i.test(sampleId)) {
        return;
      }
      const odValue = Number(row.OD ?? row.od);
      if (Number.isNaN(odValue)) {
        return;
      }
      const controlLabel = normalizeControlLabel(sampleId) || sampleId;
      const range = parseControlRange(sampleId);
      const existing = controlMap.get(controlLabel) || {
        controlLabel,
        readings: [],
        range: range || null,
      };
      existing.readings.push(odValue);
      if (!existing.range && range) {
        existing.range = range;
      }
      controlMap.set(controlLabel, existing);
    });
  }

  const controls = Array.from(controlMap.values()).map((entry) => {
    const averageOd =
      entry.readings.reduce((total, value) => total + value, 0) /
      entry.readings.length;
    const outOfRange =
      entry.range &&
      (averageOd < entry.range.min || averageOd > entry.range.max);
    if (outOfRange) {
      warnings.push({
        type: 'control_out_of_range',
        message: `${entry.controlLabel} average OD ${averageOd.toFixed(
          3,
        )} outside ${entry.range.min}-${entry.range.max}.`,
        controlLabel: entry.controlLabel,
        averageOd,
        range: entry.range,
      });
    }
    return {
      controlLabel: entry.controlLabel,
      readings: entry.readings.length,
      averageOd,
      range: entry.range,
      outOfRange,
    };
  });

  return { controls, warnings };
};

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
    if (run.designId) {
      const designExists = store.experimentDesigns.some(
        (entry) => entry.id === run.designId,
      );
      if (!designExists) {
        errors.push(`ExperimentRun.designId references unknown design ${run.designId}`);
      }
    }
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
        details: {
          runId: stepLog.runId,
          lotCount: stepLog.lots?.length || 0,
          lotTypes: summarizeLotTypes(stepLog.lots),
        },
      },
      logger,
    );

    writeJson(response, 200, { stepLog });
  };

  return { handleStepLog, store };
};

const createSummaryHandler = ({ store = createSummaryStore() } = {}) => {
  const handleSummary = async (request, response) => {
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
    const controlSummary = await buildControlSummary({ store, runId });
    const standardCurveSummary = await buildStandardCurveSummary({ store, runId });
    const experimentDesign = run.designId
      ? store.experimentDesigns.find((entry) => entry.id === run.designId)
      : null;
    const factorEffects = experimentDesign
      ? await calculateFactorEffects({
          store,
          design: experimentDesign,
          runSeriesId: run.runSeriesId,
        })
      : null;
    const latestTimestamp = findLatestTimestamp([
      run.finishedAt,
      run.startedAt,
      ...stepLogs.map((entry) => entry.timestamp),
      ...attachments.map((entry) => entry.createdAt),
    ]);

    const stepLotDetails = stepLogs.map((entry) => ({
      stepId: entry.stepId,
      stepName: entry.stepName,
      lots: entry.lots || [],
    }));

    writeJson(response, 200, {
      run,
      stepLogs,
      attachments,
      lots: {
        run: run.lots || [],
        steps: stepLotDetails,
      },
      controls: controlSummary.controls,
      warnings: controlSummary.warnings,
      standardCurve: standardCurveSummary,
      experimentDesign,
      factorEffects,
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
