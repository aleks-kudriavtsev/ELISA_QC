const { LotBatch } = require('./lotBatch');

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
    completedSignature,
    lots = [],
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
    this.completedSignature = completedSignature;
    this.lots = Array.isArray(lots) ? lots.map((lot) => new LotBatch(lot)) : [];
  }
}

module.exports = { ExperimentRun };
