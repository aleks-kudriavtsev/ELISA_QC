const requiredCsvHeaders = ['SampleID', 'OD'];

const normalizeHeader = (value) => value.replace(/^\uFEFF/, '').trim();

const parseCsvHeader = (content) => {
  const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) {
    return [];
  }
  return lines[0].split(',').map((entry) => normalizeHeader(entry));
};

const validateCsvContent = (content, context = 'CSV') => {
  const errors = [];
  if (!content || typeof content !== 'string') {
    return [`${context} content must be a string`];
  }
  const headers = parseCsvHeader(content);
  if (headers.length === 0) {
    errors.push(`${context} must include a header row`);
    return errors;
  }
  const missing = requiredCsvHeaders.filter((header) => !headers.includes(header));
  if (missing.length > 0) {
    errors.push(`${context} missing required columns: ${missing.join(', ')}`);
  }
  if (content.split(/\r?\n/).filter((line) => line.trim().length > 0).length < 2) {
    errors.push(`${context} must include at least one data row`);
  }
  return errors;
};

module.exports = {
  parseCsvHeader,
  requiredCsvHeaders,
  validateCsvContent,
};
