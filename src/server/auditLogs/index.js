const { AuditLog } = require('../models');
const { validateAuditLog } = require('../validation');
const { logAuditChange } = require('../logging/auditLogger');

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

const extractRunIdFromUrl = (requestUrl) => {
  const match = requestUrl.match(/^\/api\/runs\/([^/]+)\/audit-logs$/);
  return match ? match[1] : null;
};

const escapeCsvValue = (value) => {
  const safeValue = value === undefined || value === null ? '' : String(value);
  return `"${safeValue.replace(/"/g, '""')}"`;
};

const buildAuditCsv = (auditLogs) => {
  const headers = [
    'id',
    'runId',
    'userId',
    'userName',
    'timestamp',
    'field',
    'oldValue',
    'newValue',
    'context',
  ];
  const rows = auditLogs.map((entry) => {
    const contextValue = entry.context ? JSON.stringify(entry.context) : '';
    return [
      entry.id,
      entry.runId,
      entry.userId,
      entry.userName || '',
      entry.timestamp,
      entry.field,
      entry.oldValue,
      entry.newValue,
      contextValue,
    ].map(escapeCsvValue);
  });
  return [headers.map(escapeCsvValue).join(','), ...rows.map((row) => row.join(','))].join(
    '\n',
  );
};

const createAuditLogHandler = ({ store, logger = console } = {}) => {
  const handleAuditLog = async (request, response) => {
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
        error: { code: 'missing_payload', message: 'AuditLog payload is required' },
      });
      return;
    }

    const requestUrl = new URL(request.url || '', 'http://localhost');
    if (!payload.runId) {
      payload.runId = extractRunIdFromUrl(requestUrl.pathname);
    }

    const auditLog = new AuditLog(payload);
    const errors = validateAuditLog(auditLog);
    if (errors.length > 0) {
      writeJson(response, 400, {
        error: {
          code: 'validation_failed',
          message: 'AuditLog validation failed',
          details: errors,
        },
      });
      return;
    }

    store.auditLogs.push(auditLog);
    logAuditChange(
      {
        auditId: auditLog.id,
        runId: auditLog.runId,
        userId: auditLog.userId,
        userName: auditLog.userName,
        timestamp: auditLog.timestamp,
        field: auditLog.field,
        oldValue: auditLog.oldValue,
        newValue: auditLog.newValue,
      },
      logger,
    );

    writeJson(response, 200, { auditLog });
  };

  const handleAuditLogExport = (request, response) => {
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

    const auditLogs = store.auditLogs
      .filter((entry) => entry.runId === runId)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    const format = requestUrl.searchParams.get('format');
    if (format === 'csv') {
      response.statusCode = 200;
      response.setHeader('Content-Type', 'text/csv');
      response.end(buildAuditCsv(auditLogs));
      return;
    }

    writeJson(response, 200, { auditLogs });
  };

  return { handleAuditLog, handleAuditLogExport };
};

module.exports = { createAuditLogHandler };
