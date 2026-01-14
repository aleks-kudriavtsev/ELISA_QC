const normalizeHeader = (value) => String(value || '').trim().toLowerCase();

const readerTemplates = [
  {
    id: 'generic',
    name: 'Generic CSV',
    instrumentType: 'reader',
    description: 'Generic export with Sample ID and OD columns.',
    headerAliases: {
      sampleId: ['sampleid', 'sample id', 'sample'],
      od: ['od', 'absorbance', 'abs', 'optical density'],
      well: ['well', 'well position', 'wellid'],
      wavelength: ['wavelength', 'wavelength (nm)', 'lambda'],
    },
  },
  {
    id: 'bioRad_microplate',
    name: 'Bio-Rad Microplate',
    instrumentType: 'bioRad',
    description: 'Bio-Rad microplate reader export.',
    headerAliases: {
      sampleId: ['sample id', 'sampleid', 'sample'],
      od: ['od', 'absorbance', 'abs 450', 'abs 450nm'],
      well: ['well', 'well position', 'wellid'],
      wavelength: ['wavelength', 'wavelength (nm)'],
    },
  },
  {
    id: 'tecan_infinite',
    name: 'Tecan Infinite',
    instrumentType: 'tecan',
    description: 'Tecan Infinite reader export.',
    headerAliases: {
      sampleId: ['sample', 'sample id', 'sampleid'],
      od: ['od', 'abs 450', 'absorbance 450', 'absorbance'],
      well: ['well', 'position', 'well position'],
      wavelength: ['wavelength', 'wavelength (nm)', 'lambda'],
    },
  },
];

const findHeaderMatch = (headers, candidates) => {
  const normalizedCandidates = candidates.map((entry) => normalizeHeader(entry));
  return headers.find((header) => normalizedCandidates.includes(normalizeHeader(header))) || null;
};

const templateMatches = (template, headers) => {
  const sampleHeader = findHeaderMatch(headers, template.headerAliases.sampleId);
  const odHeader = findHeaderMatch(headers, template.headerAliases.od);
  return Boolean(sampleHeader && odHeader);
};

const resolveReaderTemplate = ({ templateId, instrumentType, headers }) => {
  if (templateId) {
    return readerTemplates.find((template) => template.id === templateId) || null;
  }

  if (instrumentType) {
    const byInstrument = readerTemplates.filter(
      (template) => template.instrumentType === instrumentType,
    );
    const matched = byInstrument.find((template) => templateMatches(template, headers));
    if (matched) {
      return matched;
    }
  }

  return readerTemplates.find((template) => templateMatches(template, headers)) || null;
};

module.exports = {
  readerTemplates,
  resolveReaderTemplate,
  normalizeHeader,
  findHeaderMatch,
};
