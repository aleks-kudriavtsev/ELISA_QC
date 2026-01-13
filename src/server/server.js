const { createApiServer } = require('./app');

const port = Number.parseInt(process.env.PORT, 10) || 3001;

const { server } = createApiServer({ logger: console });

server.listen(port, () => {
  console.log(
    `[server] API listening on http://localhost:${port} at ${new Date().toISOString()}`,
  );
});
