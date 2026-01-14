const serializeAuditValue = (value) => {
  if (value === undefined || value === null) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  try {
    return JSON.stringify(value);
  } catch (error) {
    return String(value);
  }
};

class AuditLog {
  constructor({
    id,
    runId,
    userId,
    userName,
    timestamp,
    field,
    oldValue,
    newValue,
    context = {},
  }) {
    this.id = id;
    this.runId = runId;
    this.userId = userId;
    this.userName = userName;
    this.timestamp = timestamp;
    this.field = field;
    this.oldValue = serializeAuditValue(oldValue);
    this.newValue = serializeAuditValue(newValue);
    this.context = context || {};
  }
}

module.exports = { AuditLog };
