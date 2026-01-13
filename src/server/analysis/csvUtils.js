const normalizeHeader = (value) => value.replace(/^\uFEFF/, '').trim();

const parseCsvRows = (content) => {
  const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) {
    return { headers: [], rows: [] };
  }
  const headers = lines[0].split(',').map((entry) => normalizeHeader(entry));
  const rows = lines.slice(1).map((line) => {
    const values = line.split(',').map((entry) => entry.trim());
    return headers.reduce((accumulator, header, index) => {
      accumulator[header] = values[index];
      return accumulator;
    }, {});
  });
  return { headers, rows };
};

const parseControlRange = (sampleId) => {
  if (!sampleId) {
    return null;
  }

  const rangeMatch =
    sampleId.match(/\[(?<min>[\d.]+)\s*[-–]\s*(?<max>[\d.]+)\]/) ||
    sampleId.match(/\((?<min>[\d.]+)\s*[-–]\s*(?<max>[\d.]+)\)/) ||
    sampleId.match(/min\s*=?\s*(?<min>[\d.]+)\s*max\s*=?\s*(?<max>[\d.]+)/i);

  if (!rangeMatch?.groups) {
    return null;
  }

  const min = Number(rangeMatch.groups.min);
  const max = Number(rangeMatch.groups.max);
  if (Number.isNaN(min) || Number.isNaN(max)) {
    return null;
  }

  return { min, max };
};

const normalizeControlLabel = (sampleId) =>
  sampleId
    .replace(/\s*[\[(].*?[\])]\s*/g, '')
    .replace(/\s*min\s*=?\s*[\d.]+\s*max\s*=?\s*[\d.]+/i, '')
    .trim();

module.exports = {
  normalizeControlLabel,
  parseControlRange,
  parseCsvRows,
};
