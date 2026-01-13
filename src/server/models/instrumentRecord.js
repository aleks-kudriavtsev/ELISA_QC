class InstrumentRecord {
  constructor({
    id,
    runId,
    stepId,
    instrumentId,
    instrumentType,
    recordedAt,
    dataPath,
  }) {
    this.id = id;
    this.runId = runId;
    this.stepId = stepId;
    this.instrumentId = instrumentId;
    this.instrumentType = instrumentType;
    this.recordedAt = recordedAt;
    this.dataPath = dataPath;
  }
}

module.exports = { InstrumentRecord };
