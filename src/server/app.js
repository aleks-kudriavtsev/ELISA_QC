const http = require('http');

const JSON_CONTENT_TYPE = { 'Content-Type': 'application/json' };

const applyCorsHeaders = (response) => {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  response.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization',
  );
};

const sendJson = (response, statusCode, payload) => {
  response.writeHead(statusCode, JSON_CONTENT_TYPE);
  response.end(JSON.stringify(payload));
};

const { createUploadHandler } = require('./uploads');
const {
  createRunHandler,
  createStepLogHandler,
  createSummaryHandler,
  createSummaryStore,
} = require('./summary');

const createApiServer = ({ logger = console } = {}) => {
  const store = createSummaryStore();
  const { handleUpload } = createUploadHandler({ store, logger });
  const { handleRun } = createRunHandler({ store });
  const { handleStepLog } = createStepLogHandler({ store, logger });
  const { handleSummary } = createSummaryHandler({ store });

  const server = http.createServer((request, response) => {
    applyCorsHeaders(response);

    if (request.method === 'OPTIONS') {
      response.statusCode = 204;
      response.end();
      return;
    }

    const requestUrl = new URL(request.url || '', 'http://localhost');
    const { pathname } = requestUrl;

    if (pathname === '/api/health') {
      sendJson(response, 200, { status: 'ok' });
      return;
    }

    if (pathname === '/api/uploads') {
      return handleUpload(request, response);
    }

    if (pathname === '/api/runs') {
      return handleRun(request, response);
    }

    if (pathname.startsWith('/api/runs/') && pathname.endsWith('/steps')) {
      return handleStepLog(request, response);
    }

    if (pathname === '/api/summary') {
      return handleSummary(request, response);
    }

    sendJson(response, 404, { error: 'Not Found' });
  });

  return { server, store };
};

module.exports = { createApiServer };
