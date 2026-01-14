const xlsx = require('xlsx');

const { findHeaderMatch } = require('./readerTemplates');

const buildRowObjects = (headers, rows) =>
  rows.map((row) =>
    headers.reduce((accumulator, header, index) => {
      accumulator[header] = row[index];
      return accumulator;
    }, {}),
  );

const parseCsvContent = (content) => {
  const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }
  const headers = lines[0].split(',').map((entry) => entry.trim());
  const rows = lines.slice(1).map((line) => line.split(',').map((entry) => entry.trim()));
  return { headers, rows };
};

const parseXlsxContent = (dataBuffer) => {
  const workbook = xlsx.read(dataBuffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return { headers: [], rows: [] };
  }
  const sheet = workbook.Sheets[sheetName];
  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, raw: false });
  if (!Array.isArray(rows) || rows.length === 0) {
    return { headers: [], rows: [] };
  }
  const headers = rows[0].map((entry) => String(entry || '').trim());
  const dataRows = rows.slice(1).map((row) =>
    Array.isArray(row) ? row.map((entry) => String(entry || '').trim()) : [],
  );
  return { headers, rows: dataRows };
};

const loadTabularData = ({ kind, dataBuffer, contentText }) => {
  if (kind === 'xlsx') {
    return parseXlsxContent(dataBuffer);
  }
  return parseCsvContent(contentText || dataBuffer.toString('utf8'));
};

const normalizeInstrumentRows = ({ headers, rows, template }) => {
  const sampleHeader = findHeaderMatch(headers, template.headerAliases.sampleId);
  const odHeader = findHeaderMatch(headers, template.headerAliases.od);
  const wellHeader = findHeaderMatch(headers, template.headerAliases.well || []);
  const wavelengthHeader = findHeaderMatch(headers, template.headerAliases.wavelength || []);

  if (!sampleHeader || !odHeader) {
    return { normalizedRows: [], detectedHeaders: null };
  }

  const dataRows = buildRowObjects(headers, rows);
  const normalizedRows = dataRows
    .map((row) => {
      const sampleId = row[sampleHeader];
      const od = row[odHeader];
      if (!sampleId || od === undefined || od === null || od === '') {
        return null;
      }
      const normalized = {
        SampleID: String(sampleId).trim(),
        OD: String(od).trim(),
      };
      if (wellHeader && row[wellHeader]) {
        normalized.Well = String(row[wellHeader]).trim();
      }
      if (wavelengthHeader && row[wavelengthHeader]) {
        normalized.Wavelength = String(row[wavelengthHeader]).trim();
      }
      return normalized;
    })
    .filter(Boolean);

  return {
    normalizedRows,
    detectedHeaders: {
      sampleId: sampleHeader,
      od: odHeader,
      well: wellHeader,
      wavelength: wavelengthHeader,
    },
  };
};

const buildNormalizedCsv = (normalizedRows) => {
  const includeWell = normalizedRows.some((row) => row.Well);
  const includeWavelength = normalizedRows.some((row) => row.Wavelength);
  const headers = ['SampleID', 'OD'];
  if (includeWell) {
    headers.push('Well');
  }
  if (includeWavelength) {
    headers.push('Wavelength');
  }
  const lines = [headers.join(',')];
  normalizedRows.forEach((row) => {
    const values = [row.SampleID, row.OD];
    if (includeWell) {
      values.push(row.Well || '');
    }
    if (includeWavelength) {
      values.push(row.Wavelength || '');
    }
    lines.push(values.join(','));
  });
  return lines.join('\n');
};

module.exports = {
  buildNormalizedCsv,
  loadTabularData,
  normalizeInstrumentRows,
};
