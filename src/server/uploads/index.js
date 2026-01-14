const fs = require('fs/promises');
const path = require('path');

const { Attachment } = require('../models/attachment');
const { InstrumentRecord } = require('../models/instrumentRecord');
const { Upload } = require('../models/upload');
const { logStep } = require('../logging/stepLogger');
const { validateAttachment } = require('../validation/attachmentValidation');
const { validateInstrumentRecord } = require('../validation/instrumentRecordValidation');
const { validateUpload } = require('../validation/uploadValidation');
const { validateCsvContent } = require('../validation/csvValidation');
const { resolveReaderTemplate } = require('./readerTemplates');
const {
  buildNormalizedCsv,
  loadTabularData,
  normalizeInstrumentRows,
} = require('./tabularImport');

const defaultStorageRoot = path.resolve(__dirname, '../../../..');

const createUploadStore = () => ({
  uploads: [],
  attachments: [],
  instrumentRecords: [],
});

const decodeBase64 = (value) => Buffer.from(value, 'base64');

const resolveKind = ({ kind, contentType, fileName }) => {
  if (kind) {
    return kind;
  }
  if (contentType?.startsWith('image/')) {
    return 'image';
  }
  if (
    contentType === 'text/csv' ||
    fileName?.toLowerCase().endsWith('.csv')
  ) {
    return 'csv';
  }
  if (
    contentType ===
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    fileName?.toLowerCase().endsWith('.xlsx')
  ) {
    return 'xlsx';
  }
  return 'unknown';
};

const createUploadHandler = ({
  store = createUploadStore(),
  storageRoot = defaultStorageRoot,
  logger = console,
} = {}) => {
  const handleUpload = async (request, response) => {
    if (request.method !== 'POST') {
      response.statusCode = 405;
      response.end();
      return;
    }

    const chunks = [];
    for await (const chunk of request) {
      chunks.push(chunk);
    }

    let payload;
    try {
      payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch (error) {
      response.statusCode = 400;
      response.setHeader('Content-Type', 'application/json');
      response.end(
        JSON.stringify({
          error: {
            code: 'invalid_json',
            message: 'Invalid JSON payload',
          },
        }),
      );
      return;
    }

    const { runId, stepId, files = [] } = payload;
    const timestamp = new Date().toISOString();
    const stepName = 'Upload files';
    logStep(
      {
        stepId: stepId || 'uploads',
        stepName,
        status: 'started',
        timestamp,
        details: { runId },
      },
      logger,
    );

    if (!runId || !Array.isArray(files) || files.length === 0) {
      response.statusCode = 400;
      response.setHeader('Content-Type', 'application/json');
      response.end(
        JSON.stringify({
          error: {
            code: 'missing_fields',
            message: 'runId and files are required',
          },
        }),
      );
      return;
    }

    const uploadResponses = [];
    const errors = [];

    for (const [index, file] of files.entries()) {
      const fileName = file.fileName || `upload_${index}`;
      const contentType = file.contentType || 'application/octet-stream';
      const resolvedKind = resolveKind({ kind: file.kind, contentType, fileName });
      const storageDir =
        resolvedKind === 'csv' || resolvedKind === 'xlsx'
          ? 'csv/raw'
          : resolvedKind === 'image'
            ? 'images/raw'
            : 'uploads';
      const storagePath = path.join(storageDir, runId, fileName);
      const absolutePath = path.join(storageRoot, storagePath);
      const id = `upload_${Date.now()}_${index}`;
      const sizeBytes = file.sizeBytes || file.contentBase64?.length || 0;

      if (resolvedKind === 'unknown') {
        errors.push(`Unsupported file type for ${fileName}`);
        continue;
      }

      const dataBuffer = file.contentBase64
        ? decodeBase64(file.contentBase64)
        : Buffer.from(file.contentText || '', 'utf8');

      let processedCsv = null;
      let processedPath = null;
      let readerTemplate = null;

      if (resolvedKind === 'csv' || resolvedKind === 'xlsx') {
        const { headers, rows } = loadTabularData({
          kind: resolvedKind,
          dataBuffer,
          contentText: file.contentText,
        });
        readerTemplate = resolveReaderTemplate({
          templateId: file.templateId,
          instrumentType: file.instrumentType,
          headers,
        });

        if (!readerTemplate) {
          errors.push(`No matching import template for ${fileName}`);
          continue;
        }

        const { normalizedRows } = normalizeInstrumentRows({
          headers,
          rows,
          template: readerTemplate,
        });

        if (normalizedRows.length === 0) {
          errors.push(`No usable rows found for ${fileName}`);
          continue;
        }

        processedCsv = buildNormalizedCsv(normalizedRows);
        const csvErrors = validateCsvContent(processedCsv, `CSV ${fileName}`);
        if (csvErrors.length > 0) {
          errors.push(...csvErrors);
          continue;
        }

        const baseName = path.parse(fileName).name;
        const processedFileName = `${baseName}_normalized.csv`;
        processedPath = path.join('csv/processed', runId, processedFileName);
      }

      await fs.mkdir(path.dirname(absolutePath), { recursive: true });
      await fs.writeFile(absolutePath, dataBuffer);

      if (processedCsv && processedPath) {
        const processedAbsolute = path.join(storageRoot, processedPath);
        await fs.mkdir(path.dirname(processedAbsolute), { recursive: true });
        await fs.writeFile(processedAbsolute, processedCsv, 'utf8');
      }

      const upload = new Upload({
        id,
        runId,
        stepId,
        fileName,
        contentType,
        kind: resolvedKind,
        storagePath,
        createdAt: timestamp,
        sizeBytes,
      });
      const uploadErrors = validateUpload(upload);
      if (uploadErrors.length > 0) {
        errors.push(...uploadErrors);
        continue;
      }

      store.uploads.push(upload);
      uploadResponses.push(upload);

      if (resolvedKind === 'image') {
        const attachment = new Attachment({
          id: `att_${Date.now()}_${index}`,
          runId,
          stepId,
          type: 'image',
          path: storagePath,
          label: file.label || fileName,
          createdAt: timestamp,
        });
        const attachmentErrors = validateAttachment(attachment);
        if (attachmentErrors.length > 0) {
          errors.push(...attachmentErrors);
        } else {
          store.attachments.push(attachment);
        }
      }

      if (resolvedKind === 'csv' || resolvedKind === 'xlsx') {
        const instrumentRecord = new InstrumentRecord({
          id: `inst_${Date.now()}_${index}`,
          runId,
          stepId,
          instrumentId: file.instrumentId || 'reader_unknown',
          instrumentType: readerTemplate?.instrumentType || file.instrumentType || 'reader',
          recordedAt: timestamp,
          dataPath: processedPath || storagePath,
          templateId: readerTemplate?.id || null,
          rawPath: storagePath,
        });
        const instrumentErrors = validateInstrumentRecord(instrumentRecord);
        if (instrumentErrors.length > 0) {
          errors.push(...instrumentErrors);
        } else {
          store.instrumentRecords.push(instrumentRecord);
        }
      }
    }

    if (errors.length > 0) {
      logStep(
        {
          stepId: stepId || 'uploads',
          stepName,
          status: 'failed',
          timestamp: new Date().toISOString(),
          details: { runId },
        },
        logger,
      );
      response.statusCode = 400;
      response.setHeader('Content-Type', 'application/json');
      response.end(
        JSON.stringify({
          error: {
            code: 'validation_failed',
            message: 'Upload validation failed',
            details: errors,
          },
        }),
      );
      return;
    }

    logStep(
      {
        stepId: stepId || 'uploads',
        stepName,
        status: 'finished',
        timestamp: new Date().toISOString(),
        details: { runId, count: uploadResponses.length },
      },
      logger,
    );
    response.statusCode = 200;
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify({ items: uploadResponses }));
  };

  return { handleUpload, store };
};

module.exports = {
  createUploadHandler,
  createUploadStore,
};
