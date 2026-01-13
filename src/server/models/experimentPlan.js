class ExperimentPlan {
  constructor({
    id,
    name,
    protocolId,
    version,
    createdByUserId,
    createdAt,
    steps,
  }) {
    this.id = id;
    this.name = name;
    this.protocolId = protocolId;
    this.version = version;
    this.createdByUserId = createdByUserId;
    this.createdAt = createdAt;
    this.steps = steps;
  }
}

module.exports = { ExperimentPlan };
