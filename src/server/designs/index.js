const { ExperimentDesign } = require('../models');
const { generateDesignMatrix } = require('../analysis/experimentDesign');
const { validateExperimentDesign } = require('../validation');

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

const applyGeneratorDefaults = (payload) => {
  if (!payload?.generator) {
    return payload;
  }
  const { factors, matrix } = generateDesignMatrix(
    payload.generator,
    payload.factors || [],
  );
  return {
    ...payload,
    factors: payload.factors?.length ? payload.factors : factors,
    matrix: payload.matrix?.length ? payload.matrix : matrix,
  };
};

const createDesignHandler = ({ store = { experimentDesigns: [] } } = {}) => {
  const handleDesign = async (request, response) => {
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
        error: { code: 'missing_payload', message: 'Design payload is required' },
      });
      return;
    }

    const preparedPayload = applyGeneratorDefaults(payload);
    const design = new ExperimentDesign(preparedPayload);
    const errors = validateExperimentDesign(design);
    if (errors.length > 0) {
      writeJson(response, 400, {
        error: {
          code: 'validation_failed',
          message: 'Design validation failed',
          details: errors,
        },
      });
      return;
    }

    const existingIndex = store.experimentDesigns.findIndex(
      (entry) => entry.id === design.id,
    );
    if (existingIndex >= 0) {
      store.experimentDesigns.splice(existingIndex, 1, design);
    } else {
      store.experimentDesigns.push(design);
    }

    writeJson(response, 200, { design });
  };

  return { handleDesign };
};

module.exports = { createDesignHandler };
