const { User } = require('./user');
const { ExperimentPlan } = require('./experimentPlan');
const { ExperimentRun } = require('./experimentRun');
const { StepLog } = require('./stepLog');
const { Attachment } = require('./attachment');
const { InstrumentRecord } = require('./instrumentRecord');
const { Upload } = require('./upload');

module.exports = {
  User,
  ExperimentPlan,
  ExperimentRun,
  StepLog,
  Attachment,
  InstrumentRecord,
  Upload,
};
