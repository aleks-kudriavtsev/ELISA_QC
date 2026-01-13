class Upload {
  constructor({
    id,
    runId,
    stepId,
    fileName,
    contentType,
    kind,
    storagePath,
    createdAt,
    sizeBytes,
  }) {
    this.id = id;
    this.runId = runId;
    this.stepId = stepId;
    this.fileName = fileName;
    this.contentType = contentType;
    this.kind = kind;
    this.storagePath = storagePath;
    this.createdAt = createdAt;
    this.sizeBytes = sizeBytes;
  }
}

module.exports = { Upload };
