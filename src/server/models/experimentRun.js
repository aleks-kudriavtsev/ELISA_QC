class ExperimentRun {
  constructor({
    id,
    planId,
    runNumber,
    status,
    startedByUserId,
    startedAt,
    finishedAt,
  }) {
    this.id = id;
    this.planId = planId;
    this.runNumber = runNumber;
    this.status = status;
    this.startedByUserId = startedByUserId;
    this.startedAt = startedAt;
    this.finishedAt = finishedAt;
  }
}

module.exports = { ExperimentRun };
