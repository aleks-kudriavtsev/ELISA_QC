class Attachment {
  constructor({
    id,
    runId,
    stepId,
    type,
    path,
    label,
    createdAt,
  }) {
    this.id = id;
    this.runId = runId;
    this.stepId = stepId;
    this.type = type;
    this.path = path;
    this.label = label;
    this.createdAt = createdAt;
  }
}

module.exports = { Attachment };
