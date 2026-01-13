const fs = require('fs');
const path = require('path');

const protocolsDirectory = path.resolve(__dirname, '../../../protocols/elisa');

const resolveProtocolId = (schema, fallbackId) =>
  schema?.properties?.protocolId?.default ||
  schema?.protocolId ||
  fallbackId;

const resolveProtocolName = (schema, fallbackId) =>
  schema?.properties?.name?.const ||
  schema?.title ||
  fallbackId;

const resolveProtocolVersion = (schema) =>
  schema?.properties?.schemaVersion?.default || schema?.schemaVersion;

const loadProtocolSchemas = () => {
  const entries = fs.readdirSync(protocolsDirectory, { withFileTypes: true });
  return entries.reduce((accumulator, entry) => {
    if (!entry.isFile() || !entry.name.endsWith('.json')) {
      return accumulator;
    }

    const filePath = path.join(protocolsDirectory, entry.name);
    const rawSchema = fs.readFileSync(filePath, 'utf8');
    const schema = JSON.parse(rawSchema);
    const fallbackId = path.basename(entry.name, '.json');
    const protocolId = resolveProtocolId(schema, fallbackId);

    accumulator[protocolId] = schema;
    return accumulator;
  }, {});
};

let cachedSchemas;

const getProtocolSchemas = () => {
  if (!cachedSchemas) {
    cachedSchemas = loadProtocolSchemas();
  }
  return cachedSchemas;
};

const getProtocolSchema = (protocolId) => {
  if (!protocolId) {
    return undefined;
  }
  return getProtocolSchemas()[protocolId];
};

const listProtocols = () => {
  const schemas = getProtocolSchemas();
  return Object.entries(schemas).map(([protocolId, schema]) => ({
    protocolId,
    name: resolveProtocolName(schema, protocolId),
    version: resolveProtocolVersion(schema),
    summary: schema?.description || schema?.title || protocolId,
  }));
};

module.exports = {
  getProtocolSchema,
  getProtocolSchemas,
  listProtocols,
};
