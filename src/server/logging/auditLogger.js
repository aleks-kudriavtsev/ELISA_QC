const formatAuditLogMessage = ({
  auditId,
  runId,
  userId,
  userName,
  timestamp,
  field,
  oldValue,
  newValue,
}) => {
  return [
    `audit=${auditId}`,
    `run=${runId}`,
    `user=${userId}`,
    userName ? `name=${userName}` : null,
    `timestamp=${timestamp}`,
    `field=${field}`,
    `old=${oldValue}`,
    `new=${newValue}`,
  ]
    .filter(Boolean)
    .join(' ');
};

const logAuditChange = (payload, logger = console) => {
  const message = formatAuditLogMessage(payload);
  if (typeof logger.info === 'function') {
    logger.info(message, payload);
  } else {
    logger.log(message);
  }
  return message;
};

module.exports = {
  formatAuditLogMessage,
  logAuditChange,
};
