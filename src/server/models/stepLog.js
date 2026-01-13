const { LotBatch } = require('./lotBatch');

class StepLog {
  constructor({
    id,
    runId,
    stepId,
    stepName,
    status,
    timestamp,
    message,
    lots = [],
  }) {
    this.id = id;
    this.runId = runId;
    this.stepId = stepId;
    this.stepName = stepName;
    this.status = status;
    this.timestamp = timestamp;
    this.message = message;
    this.lots = Array.isArray(lots) ? lots.map((lot) => new LotBatch(lot)) : [];
  }
}

module.exports = { StepLog };
