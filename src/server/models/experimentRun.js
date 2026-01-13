class ExperimentRun {
  constructor({
    id,
    planId,
    runSeriesId,
    designId,
    designRowId,
    runNumber,
    status,
    startedByUserId,
    startedAt,
    finishedAt,
  }) {
    this.id = id;
    this.planId = planId;
    this.runSeriesId = runSeriesId;
    this.designId = designId;
    this.designRowId = designRowId;
    this.runNumber = runNumber;
    this.status = status;
    this.startedByUserId = startedByUserId;
    this.startedAt = startedAt;
    this.finishedAt = finishedAt;
  }
}

module.exports = { ExperimentRun };
