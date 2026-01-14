const extractExpectedFieldIds = (expectedFieldsSchema) => {
  const constraints = expectedFieldsSchema?.allOf || [];
  return constraints
    .map((constraint) => constraint?.contains?.properties?.fieldId?.const)
    .filter(Boolean);
};

const extractProtocolSteps = (protocolSchema) => {
  const stepSchemas = protocolSchema?.properties?.steps?.prefixItems || [];
  return stepSchemas
    .map((stepSchema) => {
      const stepId =
        stepSchema?.properties?.id?.const || stepSchema?.properties?.id?.default;
      const stepName =
        stepSchema?.properties?.name?.const || stepSchema?.properties?.name?.default;
      return {
        stepId,
        stepName,
        expectedFieldIds: extractExpectedFieldIds(
          stepSchema?.properties?.expectedFields,
        ),
      };
    })
    .filter((step) => step.stepId);
};

module.exports = {
  extractExpectedFieldIds,
  extractProtocolSteps,
};
