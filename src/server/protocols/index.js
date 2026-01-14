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

const {
  diffProtocolSnapshots,
  normalizeVersionHistory,
  resolveProtocolVersion,
} = require('./versioning');

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

const getProtocolVersionHistory = (protocolId) => {
  const schema = getProtocolSchema(protocolId);
  if (!schema) {
    return [];
  }
  return normalizeVersionHistory(schema);
};

const getProtocolVersionSnapshot = (protocolId, version) => {
  const history = getProtocolVersionHistory(protocolId);
  return history.find((entry) => entry.version === version) || null;
};

const diffProtocolVersions = (protocolId, fromVersion, toVersion) => {
  const fromSnapshot = getProtocolVersionSnapshot(protocolId, fromVersion);
  const toSnapshot = getProtocolVersionSnapshot(protocolId, toVersion);
  if (!fromSnapshot || !toSnapshot) {
    return null;
  }
  return diffProtocolSnapshots({ fromSnapshot, toSnapshot });
};

module.exports = {
  getProtocolSchema,
  getProtocolSchemas,
  getProtocolVersionHistory,
  getProtocolVersionSnapshot,
  diffProtocolVersions,
  listProtocols,
};
