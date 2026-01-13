class StepLog {
  constructor({
    id,
    runId,
    stepId,
    stepName,
    status,
    timestamp,
    message,
  }) {
    this.id = id;
    this.runId = runId;
    this.stepId = stepId;
    this.stepName = stepName;
    this.status = status;
    this.timestamp = timestamp;
    this.message = message;
  }
}

module.exports = { StepLog };
