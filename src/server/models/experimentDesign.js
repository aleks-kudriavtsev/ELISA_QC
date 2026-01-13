class ExperimentDesign {
  constructor({
    id,
    name,
    createdByUserId,
    createdAt,
    factors,
    matrix,
    generator,
  }) {
    this.id = id;
    this.name = name;
    this.createdByUserId = createdByUserId;
    this.createdAt = createdAt;
    this.factors = factors;
    this.matrix = matrix;
    this.generator = generator;
  }
}

module.exports = { ExperimentDesign };
