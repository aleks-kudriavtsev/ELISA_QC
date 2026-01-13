const fs = require('fs/promises');
const path = require('path');

const { parseControlRange, parseCsvRows } = require('./csvUtils');

const defaultStorageRoot = path.resolve(__dirname, '../../../..');

const isStandardSample = (sampleId) => /std|standard/i.test(sampleId);
const isBlankSample = (sampleId) => /blank/i.test(sampleId);

const parseConcentration = (sampleId) => {
  if (!sampleId) {
    return null;
  }
  const match = sampleId.match(/[-+]?\d*\.?\d+(?:e[-+]?\d+)?/i);
  if (!match) {
    return null;
  }
  const value = Number(match[0]);
  return Number.isNaN(value) ? null : value;
};

const average = (values) =>
  values.reduce((total, value) => total + value, 0) / values.length;

const standardDeviation = (values, mean) => {
  if (values.length < 2) {
    return 0;
  }
  const variance =
    values.reduce((total, value) => total + (value - mean) ** 2, 0) /
    (values.length - 1);
  return Math.sqrt(variance);
};

const logisticValue = (x, params, model) => {
  const [a, b, c, d, g] = params;
  const base = 1 + (x / c) ** b;
  if (model === '5PL') {
    return d + (a - d) / base ** g;
  }
  return d + (a - d) / base;
};

const logisticInverse = (y, params, model) => {
  const [a, b, c, d, g] = params;
  if (y === d || a === d) {
    return null;
  }
  const ratio = (a - d) / (y - d);
  if (!Number.isFinite(ratio) || ratio <= 1) {
    return null;
  }
  const exponent = model === '5PL' ? 1 / g : 1;
  const base = ratio ** exponent - 1;
  if (base <= 0) {
    return null;
  }
  return c * base ** (1 / b);
};

const computeLoss = (points, params, model) =>
  points.reduce((total, point) => {
    const predicted = logisticValue(point.x, params, model);
    const diff = point.y - predicted;
    return total + diff ** 2;
  }, 0);

const clampParams = (params, model) => {
  const next = [...params];
  next[1] = Math.max(1e-6, next[1]);
  next[2] = Math.max(1e-6, next[2]);
  if (model === '5PL') {
    next[4] = Math.max(1e-6, next[4]);
  }
  return next;
};

const fitLogistic = (points, model) => {
  if (points.length < 4) {
    return null;
  }
  const yValues = points.map((point) => point.y);
  const xValues = points.map((point) => point.x);
  const a = Math.max(...yValues);
  const d = Math.min(...yValues);
  const sortedX = [...xValues].sort((left, right) => left - right);
  const c = sortedX[Math.floor(sortedX.length / 2)] || 1;
  const initialParams = model === '5PL' ? [a, 1, c, d, 1] : [a, 1, c, d, 1];

  let params = clampParams(initialParams, model);
  let learningRate = 0.001;
  let previousLoss = computeLoss(points, params, model);

  for (let iteration = 0; iteration < 300; iteration += 1) {
    const gradients = params.map((value, index) => {
      const delta = Math.abs(value) * 1e-4 + 1e-4;
      const plusParams = [...params];
      const minusParams = [...params];
      plusParams[index] += delta;
      minusParams[index] -= delta;
      const lossPlus = computeLoss(points, clampParams(plusParams, model), model);
      const lossMinus = computeLoss(points, clampParams(minusParams, model), model);
      return (lossPlus - lossMinus) / (2 * delta);
    });

    const candidateParams = clampParams(
      params.map((value, index) => value - learningRate * gradients[index]),
      model,
    );
    const candidateLoss = computeLoss(points, candidateParams, model);

    if (candidateLoss < previousLoss) {
      params = candidateParams;
      previousLoss = candidateLoss;
      learningRate = Math.min(learningRate * 1.05, 0.05);
    } else {
      learningRate = Math.max(learningRate * 0.5, 1e-6);
    }

    if (learningRate <= 1e-6) {
      break;
    }
  }

  const meanY = average(yValues);
  const totalVariance = yValues.reduce((total, value) => total + (value - meanY) ** 2, 0);
  const rSquared =
    totalVariance > 0 ? 1 - previousLoss / totalVariance : null;

  return {
    model,
    parameters:
      model === '5PL'
        ? { a: params[0], b: params[1], c: params[2], d: params[3], g: params[4] }
        : { a: params[0], b: params[1], c: params[2], d: params[3] },
    sse: previousLoss,
    rSquared,
  };
};

const selectBestModel = (fourPl, fivePl) => {
  if (fourPl && fivePl) {
    return fourPl.sse <= fivePl.sse ? fourPl : fivePl;
  }
  return fourPl || fivePl || null;
};

const buildStandardCurveSummary = async ({
  store,
  runId,
  storageRoot = defaultStorageRoot,
} = {}) => {
  const records = store.instrumentRecords.filter((entry) => entry.runId === runId);
  const standardMap = new Map();
  const blankReadings = [];
  const sampleGroups = new Map();
  const controlFlags = [];
  const controlRanges = new Map();
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
      const odValue = Number(row.OD ?? row.od);
      if (!sampleId || Number.isNaN(odValue)) {
        return;
      }

      if (!sampleGroups.has(sampleId)) {
        sampleGroups.set(sampleId, []);
      }
      sampleGroups.get(sampleId).push(odValue);

      if (isBlankSample(sampleId)) {
        blankReadings.push(odValue);
      }

      if (isStandardSample(sampleId)) {
        const concentration = parseConcentration(sampleId);
        if (concentration === null) {
          warnings.push({
            type: 'standard_missing_concentration',
            message: `Standard sample "${sampleId}" is missing a concentration.`,
          });
          return;
        }
        const existing = standardMap.get(concentration) || [];
        existing.push(odValue);
        standardMap.set(concentration, existing);
      }

      const controlRange = parseControlRange(sampleId);
      if (controlRange && !controlRanges.has(sampleId)) {
        controlRanges.set(sampleId, controlRange);
      }
    });
  }

  controlRanges.forEach((range, sampleId) => {
    const values = sampleGroups.get(sampleId) || [];
    if (values.length === 0) {
      return;
    }
    const meanOd = average(values);
    const outOfRange = meanOd < range.min || meanOd > range.max;
    if (outOfRange) {
      controlFlags.push({
        type: 'control_out_of_range',
        sampleId,
        averageOd: meanOd,
        range,
        message: `${sampleId} average OD ${meanOd.toFixed(3)} outside ${range.min}-${
          range.max
        }.`,
      });
    }
  });

  const points = Array.from(standardMap.entries())
    .map(([concentration, values]) => {
      const meanOd = average(values);
      return {
        x: concentration,
        y: meanOd,
        readings: values.length,
      };
    })
    .sort((left, right) => left.x - right.x);

  const fourPl = fitLogistic(points, '4PL');
  const fivePl = fitLogistic(points, '5PL');
  const selectedModel = selectBestModel(fourPl, fivePl);

  const curveParams = selectedModel
    ? Object.values(selectedModel.parameters)
    : null;
  const curveModel = selectedModel?.model || null;

  const blankMean = blankReadings.length > 0 ? average(blankReadings) : null;
  const blankSd =
    blankReadings.length > 0 ? standardDeviation(blankReadings, blankMean) : null;
  const lodOd =
    blankMean !== null && blankSd !== null ? blankMean + 3 * blankSd : null;
  const loqOd =
    blankMean !== null && blankSd !== null ? blankMean + 10 * blankSd : null;
  const lodConcentration =
    lodOd !== null && curveParams
      ? logisticInverse(lodOd, curveParams, curveModel)
      : null;
  const loqConcentration =
    loqOd !== null && curveParams
      ? logisticInverse(loqOd, curveParams, curveModel)
      : null;

  const cvBySample = Array.from(sampleGroups.entries()).map(([sampleId, values]) => {
    const meanOd = average(values);
    const sdOd = standardDeviation(values, meanOd);
    const cvPercent = meanOd !== 0 ? (sdOd / meanOd) * 100 : null;
    return {
      sampleId,
      readings: values.length,
      meanOd,
      sdOd,
      cvPercent,
    };
  });

  const accuracy = points.map((point) => {
    if (!curveParams) {
      return null;
    }
    const measuredConcentration = logisticInverse(point.y, curveParams, curveModel);
    if (measuredConcentration === null) {
      return null;
    }
    return {
      expectedConcentration: point.x,
      measuredConcentration,
      percentRecovery: (measuredConcentration / point.x) * 100,
      readings: point.readings,
      averageOd: point.y,
    };
  }).filter(Boolean);

  const precision = points.map((point) => {
    const values = standardMap.get(point.x) || [];
    const meanOd = average(values);
    const sdOd = standardDeviation(values, meanOd);
    const cvPercent = meanOd !== 0 ? (sdOd / meanOd) * 100 : null;
    return {
      expectedConcentration: point.x,
      cvPercent,
      readings: values.length,
    };
  });

  return {
    standardCurve: {
      selectedModel,
      models: { fourPl, fivePl },
      points: points.map((point) => ({
        concentration: point.x,
        averageOd: point.y,
        readings: point.readings,
      })),
    },
    metrics: {
      lod: {
        blankMeanOd: blankMean,
        blankSdOd: blankSd,
        lodOd,
        loqOd,
        lodConcentration,
        loqConcentration,
      },
      cv: cvBySample,
      accuracy,
      precision,
    },
    controlFlags,
    warnings,
  };
};

module.exports = {
  buildStandardCurveSummary,
};
