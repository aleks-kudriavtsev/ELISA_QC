const http = require('http');

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
    const requestUrl = new URL(request.url || '', 'http://localhost');
    const { pathname } = requestUrl;

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

    response.statusCode = 404;
    response.end();
  });

  return { server, store };
};

module.exports = { createApiServer };
