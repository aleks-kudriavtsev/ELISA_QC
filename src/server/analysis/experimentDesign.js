const { parseCsvRows } = require('./csvUtils');
const fs = require('fs/promises');
const path = require('path');

const defaultStorageRoot = path.resolve(__dirname, '../../../..');

const buildTiterLevels = ({
  levels,
  startValue,
  dilutionFactor,
  count,
}) => {
  if (Array.isArray(levels) && levels.length > 0) {
    return levels;
  }
  if (!startValue || !dilutionFactor || !count) {
    return [];
  }
  const results = [];
  for (let index = 0; index < count; index += 1) {
    results.push(startValue / dilutionFactor ** index);
  }
  return results;
};

const cartesianProduct = (arrays) =>
  arrays.reduce(
    (accumulator, levels) =>
      accumulator.flatMap((partial) => levels.map((level) => [...partial, level])),
    [[]],
  );

const createMatrixRows = ({ factors, replicates = 1, blocks = [] } = {}) => {
  const levelSets = factors.map((factor) => factor.levels || []);
  const combinations = cartesianProduct(levelSets);
  const rows = [];
  let runNumber = 1;

  combinations.forEach((combination) => {
    const baseFactorLevels = factors.reduce((accumulator, factor, index) => {
      accumulator[factor.id] = combination[index];
      return accumulator;
    }, {});

    const blockValues = blocks.length > 0 ? blocks : [null];
    blockValues.forEach((blockValue) => {
      for (let replicate = 0; replicate < replicates; replicate += 1) {
        const factorLevels = { ...baseFactorLevels };
        if (blockValue !== null) {
          factorLevels.block = blockValue;
        }
        rows.push({
          id: `row_${runNumber}`,
          runNumber,
          factorLevels,
          block: blockValue ?? null,
          replicate: replicates > 1 ? replicate + 1 : null,
        });
        runNumber += 1;
      }
    });
  });

  return rows;
};

const generateTiterMatrix = (generator = {}) => {
  const factorId = generator.factorId || 'titer';
  const factorName = generator.factorName || 'Titer';
  const levels = buildTiterLevels({
    levels: generator.levels,
    startValue: generator.startValue,
    dilutionFactor: generator.dilutionFactor,
    count: generator.count,
  });
  const factors = [
    {
      id: factorId,
      name: factorName,
      levels,
    },
  ];
  const matrix = createMatrixRows({
    factors,
    replicates: generator.replicates || 1,
  });
  return { factors, matrix };
};

const generateBlockMatrix = (generator = {}) => {
  const baseFactors = Array.isArray(generator.factors) ? generator.factors : [];
  const blocks = Array.isArray(generator.blocks) ? generator.blocks : [];
  const factors = [...baseFactors];
  const hasBlockFactor = factors.some((factor) => factor.id === 'block');
  if (!hasBlockFactor) {
    factors.push({
      id: 'block',
      name: generator.blockName || 'Block',
      levels: blocks,
    });
  }
  const matrix = createMatrixRows({
    factors,
    replicates: generator.replicates || 1,
  });
  return { factors, matrix };
};

const generateDesignMatrix = (generator = {}, fallbackFactors = []) => {
  if (!generator?.type) {
    return { factors: fallbackFactors, matrix: createMatrixRows({ factors: fallbackFactors }) };
  }
  if (generator.type === 'titer') {
    return generateTiterMatrix(generator);
  }
  if (generator.type === 'blocks') {
    return generateBlockMatrix(generator);
  }
  return { factors: fallbackFactors, matrix: createMatrixRows({ factors: fallbackFactors }) };
};

const calculateRunResponse = async ({
  store,
  runId,
  storageRoot = defaultStorageRoot,
}) => {
  const records = store.instrumentRecords.filter((entry) => entry.runId === runId);
  const values = [];

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
      const odValue = Number(row.OD ?? row.od);
      if (!Number.isNaN(odValue)) {
        values.push(odValue);
      }
    });
  }

  if (values.length === 0) {
    return null;
  }
  const mean = values.reduce((total, value) => total + value, 0) / values.length;
  return mean;
};

const calculateFactorEffects = async ({
  store,
  design,
  runSeriesId,
  storageRoot = defaultStorageRoot,
} = {}) => {
  if (!design || !runSeriesId) {
    return null;
  }
  const runs = store.runs.filter(
    (run) => run.runSeriesId === runSeriesId && run.designId === design.id,
  );

  const rowLookup = new Map(
    (design.matrix || []).map((row) => [row.id, row]),
  );

  const responses = [];
  for (const run of runs) {
    const row = rowLookup.get(run.designRowId);
    if (!row) {
      continue;
    }
    const response = await calculateRunResponse({ store, runId: run.id, storageRoot });
    if (response === null) {
      continue;
    }
    responses.push({ runId: run.id, response, row });
  }

  if (responses.length === 0) {
    return {
      overallMean: null,
      factors: [],
    };
  }

  const overallMean =
    responses.reduce((total, entry) => total + entry.response, 0) /
    responses.length;

  const factors = (design.factors || []).map((factor) => {
    const levels = factor.levels || [];
    const levelSummaries = levels.map((level) => {
      const levelResponses = responses
        .filter((entry) => entry.row.factorLevels?.[factor.id] === level)
        .map((entry) => entry.response);
      const mean =
        levelResponses.length > 0
          ? levelResponses.reduce((total, value) => total + value, 0) /
            levelResponses.length
          : null;
      return {
        level,
        meanResponse: mean,
        deltaFromOverall:
          mean === null || overallMean === null ? null : mean - overallMean,
        count: levelResponses.length,
      };
    });
    return {
      id: factor.id,
      name: factor.name,
      levels: levelSummaries,
    };
  });

  return { overallMean, factors };
};

module.exports = {
  generateDesignMatrix,
  calculateFactorEffects,
};
