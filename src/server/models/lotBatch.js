class LotBatch {
  constructor({ id, materialType, lotNumber, description }) {
    this.id = id;
    this.materialType = materialType;
    this.lotNumber = lotNumber;
    this.description = description;
  }
}

module.exports = { LotBatch };
