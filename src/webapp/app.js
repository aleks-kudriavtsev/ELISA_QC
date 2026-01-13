const steps = [
  {
    id: "protocol",
    title: "Protocol selection",
    description: "Choose a validated protocol schema before planning the run.",
  },
  {
    id: "plan",
    title: "Plan builder",
    description: "Draft the plate layout and reagent steps for the assay.",
  },
  {
    id: "checklist",
    title: "Checklist",
    description: "Confirm the critical setup steps before running ELISA.",
  },
  {
    id: "uploads",
    title: "Uploads",
    description: "Attach raw instrument exports and notes.",
  },
  {
    id: "summary",
    title: "Summary",
    description: "Review the experiment record before submission.",
  },
];

const protocolSources = [
  { fileName: "directElisa.json" },
  { fileName: "indirectElisa.json" },
  { fileName: "sandwichElisa.json" },
  { fileName: "competitiveElisa.json" },
];

const fieldLabelMap = {
  temperatureC: "Temperature (°C)",
  timeMin: "Time (min)",
  volumeUl: "Volume (µL)",
  concentrationUgMl: "Concentration (µg/mL)",
  od: "Optical density (OD)",
};

const state = {
  currentStepIndex: 0,
  selectedProtocolId: null,
  protocols: {},
  planItems: ["Prepare plate map", "Calibrate reader"],
  checklist: {
    "Calibrate pipettes": false,
    "Prepare controls": false,
    "Verify incubation times": false,
  },
  uploads: [],
  uploadStatus: {
    state: "idle",
    message: "",
    errors: [],
    items: [],
  },
  summaryStatus: {
    state: "idle",
    message: "",
    error: "",
    data: null,
    runId: null,
  },
  runId: `run-${Date.now()}`,
  planId: `plan-${Date.now()}`,
  runStartedAt: new Date().toISOString(),
  stepLogSequence: 0,
};

const webApp = window.Telegram?.WebApp;
const mainButton = webApp?.MainButton;
const backButton = webApp?.BackButton;

const stepList = document.getElementById("stepList");
const stepKicker = document.getElementById("stepKicker");
const stepTitle = document.getElementById("stepTitle");
const stepDescription = document.getElementById("stepDescription");
const stepContent = document.getElementById("stepContent");
const progressLabel = document.getElementById("progressLabel");
const progressBar = document.getElementById("progressBar");
const fallbackNextButton = document.getElementById("nextButton");
const fallbackBackButton = document.getElementById("backButton");

const resolveProtocolId = (schema, fallbackId) =>
  schema?.properties?.protocolId?.default || schema?.protocolId || fallbackId;

const resolveProtocolName = (schema, fallbackId) =>
  schema?.properties?.name?.const || schema?.title || fallbackId;

const resolveProtocolVersion = (schema) =>
  schema?.properties?.schemaVersion?.default || schema?.schemaVersion;

const postJson = async (url, payload) => {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Telegram-Init-Data": webApp?.initData || "",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => ({}));
    const errorMessage = errorPayload?.error?.message || "Request failed.";
    throw new Error(errorMessage);
  }

  return response.json().catch(() => ({}));
};

const buildRunPayload = () => ({
  id: state.runId,
  planId: state.planId,
  runNumber: 1,
  status: "running",
  startedByUserId:
    webApp?.initDataUnsafe?.user?.id?.toString() || "user-unknown",
  startedAt: state.runStartedAt,
});

const sendRunPayload = async () => {
  try {
    await postJson("/api/runs", buildRunPayload());
  } catch (error) {
    console.warn("Failed to sync run payload.", error);
  }
};

const buildStepLog = (step, status) => {
  state.stepLogSequence += 1;
  const timestamp = new Date().toISOString();
  const message = `step=${step.id} name=${step.title} status=${status} timestamp=${timestamp}`;
  return {
    id: `step-${state.stepLogSequence}`,
    runId: state.runId,
    stepId: step.id,
    stepName: step.title,
    status,
    timestamp,
    message,
  };
};

const sendStepLog = async (stepLog) => {
  try {
    await postJson(`/api/runs/${state.runId}/steps`, stepLog);
  } catch (error) {
    console.warn("Failed to sync step log.", error);
  }
};

const extractExpectedFieldIds = (expectedFieldsSchema) => {
  const constraints = expectedFieldsSchema?.allOf || [];
  return constraints
    .map((constraint) => constraint?.contains?.properties?.fieldId?.const)
    .filter(Boolean);
};

const parseProtocolSchema = (schema, fallbackId) => {
  const protocolId = resolveProtocolId(schema, fallbackId);
  const protocolName = resolveProtocolName(schema, protocolId);
  const protocolVersion = resolveProtocolVersion(schema);
  const stepSchemas = schema?.properties?.steps?.prefixItems || [];
  const stepsFromSchema = stepSchemas
    .map((stepSchema) => ({
      stepId:
        stepSchema?.properties?.id?.const || stepSchema?.properties?.id?.default,
      stepName:
        stepSchema?.properties?.name?.const ||
        stepSchema?.properties?.name?.default,
      expectedFieldIds: extractExpectedFieldIds(
        stepSchema?.properties?.expectedFields,
      ),
    }))
    .filter((step) => step.stepId);

  return {
    protocolId,
    protocolName,
    protocolVersion,
    steps: stepsFromSchema,
  };
};

const loadProtocols = async () => {
  const responses = await Promise.all(
    protocolSources.map(async (source) => {
      const response = await fetch(`/protocols/elisa/${source.fileName}`);
      if (!response.ok) {
        return null;
      }
      const schema = await response.json();
      return parseProtocolSchema(schema, source.fileName);
    }),
  );

  const protocolMap = responses.reduce((accumulator, entry) => {
    if (!entry) {
      return accumulator;
    }
    accumulator[entry.protocolId] = entry;
    return accumulator;
  }, {});

  state.protocols = protocolMap;
  if (!state.selectedProtocolId) {
    state.selectedProtocolId = responses.find((entry) => entry)?.protocolId || null;
  }
};

const logStep = (step, status) => {
  const stepLog = buildStepLog(step, status);
  console.info(JSON.stringify(stepLog));
  void sendStepLog(stepLog);
};

const logUploadStep = (status) => {
  const uploadStep = steps.find((entry) => entry.id === "uploads");
  if (!uploadStep) {
    return;
  }
  logStep(uploadStep, status);
};

const updateSummaryStatus = ({ state: statusState, message, error, data, runId }) => {
  state.summaryStatus = {
    state: statusState,
    message: message || "",
    error: error || "",
    data: data || null,
    runId: runId || state.runId,
  };
  render();
};

const fetchSummary = async () => {
  updateSummaryStatus({ state: "loading", message: "Loading summary…" });
  try {
    const response = await fetch(`/api/summary?runId=${state.runId}`, {
      headers: {
        "X-Telegram-Init-Data": webApp?.initData || "",
      },
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      const message = payload?.error?.message || "Summary request failed.";
      updateSummaryStatus({ state: "error", error: message, message });
      return;
    }

    const payload = await response.json();
    updateSummaryStatus({
      state: "success",
      message: "Summary ready.",
      data: payload,
      runId: state.runId,
    });
  } catch (error) {
    updateSummaryStatus({
      state: "error",
      error: error.message || "Summary request failed.",
      message: "Summary request failed.",
    });
  }
};

const requiredCsvHeaders = ["Well", "OD", "Wavelength", "SampleID"];

const parseCsvHeader = (content) =>
  content
    .split(/\r?\n/)
    .find((line) => line.trim().length > 0)
    ?.split(",")
    .map((header) => header.replace(/^\uFEFF/, "").trim()) || [];

const validateCsvContent = (content) => {
  const errors = [];
  const headers = parseCsvHeader(content);
  if (headers.length === 0) {
    errors.push("CSV must include a header row.");
    return errors;
  }
  const missing = requiredCsvHeaders.filter((header) => !headers.includes(header));
  if (missing.length > 0) {
    errors.push(`Missing columns: ${missing.join(", ")}`);
  }
  const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) {
    errors.push("CSV must include at least one data row.");
  }
  return errors;
};

const readFileContent = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read file."));
    if (file.type === "text/csv" || file.name.toLowerCase().endsWith(".csv")) {
      reader.onload = () =>
        resolve({ text: String(reader.result), base64: null, kind: "csv" });
      reader.readAsText(file);
    } else {
      reader.onload = () => {
        const result = String(reader.result);
        const base64 = result.split(",")[1] || "";
        resolve({ text: null, base64, kind: "image" });
      };
      reader.readAsDataURL(file);
    }
  });

const updateUploadStatus = ({ state: statusState, message, errors, items }) => {
  state.uploadStatus = {
    state: statusState,
    message,
    errors: errors || [],
    items: items || [],
  };
  render();
};

const uploadFiles = async () => {
  if (state.uploads.length === 0) {
    updateUploadStatus({
      state: "error",
      message: "Select at least one file before uploading.",
      errors: [],
    });
    return;
  }

  logUploadStep("started");
  updateUploadStatus({ state: "uploading", message: "Uploading files…", errors: [] });

  try {
    const filesPayload = await Promise.all(
      state.uploads.map(async (file) => {
        const content = await readFileContent(file);
        if (content.kind === "csv" && content.text) {
          const csvErrors = validateCsvContent(content.text);
          if (csvErrors.length > 0) {
            throw new Error(`${file.name}: ${csvErrors.join(" ")}`);
          }
        }

        return {
          fileName: file.name,
          contentType: file.type || "application/octet-stream",
          kind: content.kind,
          contentBase64: content.base64,
          contentText: content.text,
          sizeBytes: file.size,
        };
      }),
    );

    const response = await fetch("/api/uploads", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Telegram-Init-Data": webApp?.initData || "",
      },
      body: JSON.stringify({
        runId: state.runId,
        stepId: "uploads",
        files: filesPayload,
      }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      const details = payload?.error?.details || [];
      updateUploadStatus({
        state: "error",
        message: payload?.error?.message || "Upload failed.",
        errors: details.length > 0 ? details : ["Upload failed."],
      });
      logUploadStep("failed");
      if (webApp?.HapticFeedback) {
        webApp.HapticFeedback.notificationOccurred("error");
      }
      return;
    }

    const payload = await response.json();
    updateUploadStatus({
      state: "success",
      message: `Uploaded ${payload.items?.length || 0} file(s).`,
      errors: [],
      items: payload.items || [],
    });
    logUploadStep("finished");
    if (webApp?.HapticFeedback) {
      webApp.HapticFeedback.notificationOccurred("success");
    }
  } catch (error) {
    updateUploadStatus({
      state: "error",
      message: "Upload failed.",
      errors: [error.message || "Unknown error"],
    });
    logUploadStep("failed");
    if (webApp?.HapticFeedback) {
      webApp.HapticFeedback.notificationOccurred("error");
    }
  }
};

const updateProgress = () => {
  const progress = Math.round(
    (state.currentStepIndex / (steps.length - 1)) * 100,
  );
  progressLabel.textContent = `${progress}% complete`;
  progressBar.style.width = `${progress}%`;
};

const renderStepList = () => {
  stepList.innerHTML = "";
  steps.forEach((step, index) => {
    const item = document.createElement("li");
    item.className = "stepItem";
    if (index === state.currentStepIndex) {
      item.classList.add("active");
    }

    const badge = document.createElement("span");
    badge.className = "stepBadge";
    badge.textContent = `${index + 1}`;

    const label = document.createElement("span");
    label.textContent = step.title;

    item.append(badge, label);
    item.addEventListener("click", () => moveToStep(index));
    stepList.appendChild(item);
  });
};

const renderProtocolSelection = () => {
  const card = document.createElement("div");
  card.className = "card";

  const select = document.createElement("select");
  const protocols = Object.values(state.protocols);
  if (protocols.length === 0) {
    const entry = document.createElement("option");
    entry.textContent = "No protocols loaded";
    entry.value = "";
    select.appendChild(entry);
    select.disabled = true;
  } else {
    protocols.forEach((protocol) => {
      const entry = document.createElement("option");
      entry.value = protocol.protocolId;
      entry.textContent = `${protocol.protocolName} (v${protocol.protocolVersion || "n/a"})`;
      if (protocol.protocolId === state.selectedProtocolId) {
        entry.selected = true;
      }
      select.appendChild(entry);
    });
  }

  select.addEventListener("change", (event) => {
    state.selectedProtocolId = event.target.value;
    render();
  });

  card.append(
    createParagraph(
      "Protocol schema",
      "Select a JSON Schema-backed protocol for validation.",
    ),
    select,
  );

  return card;
};

const renderExpectedFields = () => {
  const protocol = state.protocols[state.selectedProtocolId];
  if (!protocol) {
    return createParagraph(
      "Protocol fields",
      "Load a protocol schema to view expected fields.",
    );
  }

  const wrapper = document.createElement("div");
  wrapper.className = "card";

  const heading = document.createElement("strong");
  heading.textContent = "Expected fields by step";
  wrapper.appendChild(heading);

  protocol.steps.forEach((step) => {
    const stepBlock = document.createElement("div");
    stepBlock.className = "expectedStep";
    const stepTitle = document.createElement("div");
    stepTitle.className = "expectedStepTitle";
    stepTitle.textContent = step.stepName || step.stepId;
    stepBlock.appendChild(stepTitle);

    const fieldList = document.createElement("ul");
    fieldList.className = "expectedFieldList";
    if (step.expectedFieldIds.length === 0) {
      const empty = document.createElement("li");
      empty.textContent = "No required fields.";
      fieldList.appendChild(empty);
    } else {
      step.expectedFieldIds.forEach((fieldId) => {
        const item = document.createElement("li");
        item.textContent = fieldLabelMap[fieldId] || fieldId;
        fieldList.appendChild(item);
      });
    }

    stepBlock.appendChild(fieldList);
    wrapper.appendChild(stepBlock);
  });

  return wrapper;
};

const renderPlanBuilder = () => {
  const card = document.createElement("div");
  card.className = "card";

  const list = document.createElement("ul");
  list.className = "planList";
  state.planItems.forEach((item) => {
    const entry = document.createElement("li");
    entry.textContent = item;
    list.appendChild(entry);
  });

  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = "Add step (e.g., Wash plate)";

  const addButton = document.createElement("button");
  addButton.type = "button";
  addButton.className = "primaryButton";
  addButton.textContent = "Add step";

  addButton.addEventListener("click", () => {
    const value = input.value.trim();
    if (!value) {
      return;
    }
    state.planItems.push(value);
    input.value = "";
    render();
  });

  card.append(
    createParagraph(
      "Draft plan",
      "Track plate prep, incubation, and readout steps.",
    ),
    list,
  );

  const row = document.createElement("div");
  row.className = "inputRow";
  row.append(input, addButton);
  card.appendChild(row);

  const wrapper = document.createElement("div");
  wrapper.append(card, renderExpectedFields());

  return wrapper;
};

const renderChecklist = () => {
  const card = document.createElement("div");
  card.className = "card";

  const list = document.createElement("div");
  list.className = "checklist";

  Object.entries(state.checklist).forEach(([label, checked]) => {
    const wrapper = document.createElement("label");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = checked;
    checkbox.addEventListener("change", (event) => {
      state.checklist[label] = event.target.checked;
      render();
    });

    const text = document.createElement("span");
    text.textContent = label;
    wrapper.append(checkbox, text);
    list.appendChild(wrapper);
  });

  card.append(
    createParagraph(
      "Pre-run checklist",
      "Confirm every setup task before starting the assay.",
    ),
    list,
  );

  return card;
};

const renderUploads = () => {
  const card = document.createElement("div");
  card.className = "card";

  const input = document.createElement("input");
  input.type = "file";
  input.multiple = true;

  const list = document.createElement("ul");
  list.className = "uploadList";
  state.uploads.forEach((file) => {
    const item = document.createElement("li");
    item.textContent = `${file.name} (${Math.round(file.size / 1024)} KB)`;
    list.appendChild(item);
  });

  const uploadButton = document.createElement("button");
  uploadButton.type = "button";
  uploadButton.className = "primaryButton";
  uploadButton.textContent =
    state.uploadStatus.state === "uploading" ? "Uploading…" : "Upload files";
  uploadButton.disabled =
    state.uploadStatus.state === "uploading" || state.uploads.length === 0;
  uploadButton.addEventListener("click", uploadFiles);

  const statusBlock = document.createElement("div");
  statusBlock.className = `uploadStatus uploadStatus--${state.uploadStatus.state}`;
  const statusMessage = document.createElement("strong");
  statusMessage.textContent = state.uploadStatus.message || "No uploads yet.";
  statusBlock.appendChild(statusMessage);

  if (state.uploadStatus.errors.length > 0) {
    const errorList = document.createElement("ul");
    errorList.className = "uploadErrors";
    state.uploadStatus.errors.forEach((error) => {
      const item = document.createElement("li");
      item.textContent = error;
      errorList.appendChild(item);
    });
    statusBlock.appendChild(errorList);
  }

  if (state.uploadStatus.items.length > 0) {
    const successList = document.createElement("ul");
    successList.className = "uploadSuccessList";
    state.uploadStatus.items.forEach((item) => {
      const entry = document.createElement("li");
      entry.textContent = `${item.fileName} → ${item.storagePath}`;
      successList.appendChild(entry);
    });
    statusBlock.appendChild(successList);
  }

  input.addEventListener("change", (event) => {
    const files = Array.from(event.target.files || []);
    state.uploads = files;
    updateUploadStatus({ state: "idle", message: "", errors: [], items: [] });
    render();
  });

  card.append(
    createParagraph("Raw exports", "Store CSV exports and plate images."),
    input,
    list,
    uploadButton,
    statusBlock,
  );

  return card;
};

const renderSummary = () => {
  const card = document.createElement("div");
  card.className = "card";

  const summaryGrid = document.createElement("div");
  summaryGrid.className = "summaryGrid";

  const checklistDone = Object.values(state.checklist).filter(Boolean).length;
  const checklistTotal = Object.keys(state.checklist).length;

  summaryGrid.append(
    summaryRow(
      "Protocol",
      state.protocols[state.selectedProtocolId]?.protocolName || "Not selected",
    ),
    summaryRow("Plan steps", `${state.planItems.length} items`),
    summaryRow("Checklist", `${checklistDone}/${checklistTotal} complete`),
    summaryRow("Uploads", `${state.uploads.length} files`),
  );

  card.append(
    createParagraph("Experiment recap", "Confirm everything before submit."),
    summaryGrid,
  );

  const resultsCard = document.createElement("div");
  resultsCard.className = "card";

  const resultsHeader = document.createElement("strong");
  resultsHeader.textContent = "Run summary";
  resultsCard.appendChild(resultsHeader);

  if (
    state.summaryStatus.state === "idle" ||
    state.summaryStatus.runId !== state.runId
  ) {
    fetchSummary();
  }

  const statusText = document.createElement("p");
  statusText.className = "summaryStatus";
  statusText.textContent =
    state.summaryStatus.state === "loading"
      ? "Loading latest run summary…"
      : state.summaryStatus.state === "error"
        ? state.summaryStatus.error || "Summary unavailable."
        : "Latest run summary loaded.";
  resultsCard.appendChild(statusText);

  if (state.summaryStatus.data) {
    const summaryData = state.summaryStatus.data;
    const details = document.createElement("div");
    details.className = "summaryGrid summaryGrid--compact";
    details.append(
      summaryRow(
        "Run status",
        summaryData.status || summaryData.run?.status || "Unknown",
      ),
      summaryRow(
        "Step logs",
        `${summaryData.counts?.stepLogs || 0} entries`,
      ),
      summaryRow(
        "Attachments",
        `${summaryData.counts?.attachments || 0} files`,
      ),
      summaryRow(
        "Last update",
        summaryData.lastUpdatedAt || "No activity yet",
      ),
    );
    resultsCard.appendChild(details);

    const attachments = summaryData.attachments || [];
    const attachmentBlock = document.createElement("div");
    attachmentBlock.className = "summaryAttachments";
    const attachmentTitle = document.createElement("strong");
    attachmentTitle.textContent = "Attachment links";
    attachmentBlock.appendChild(attachmentTitle);

    if (attachments.length === 0) {
      const empty = document.createElement("p");
      empty.textContent = "No attachments linked yet.";
      attachmentBlock.appendChild(empty);
    } else {
      const list = document.createElement("ul");
      list.className = "summaryAttachmentList";
      attachments.forEach((attachment) => {
        const item = document.createElement("li");
        const link = document.createElement("a");
        link.href = `/${attachment.path}`;
        link.textContent = attachment.label || attachment.path;
        link.target = "_blank";
        link.rel = "noreferrer";
        item.appendChild(link);
        list.appendChild(item);
      });
      attachmentBlock.appendChild(list);
    }

    resultsCard.appendChild(attachmentBlock);
  }

  const wrapper = document.createElement("div");
  wrapper.append(card, resultsCard);

  return wrapper;
};

const createParagraph = (title, text) => {
  const wrapper = document.createElement("div");
  const heading = document.createElement("strong");
  heading.textContent = title;
  const paragraph = document.createElement("p");
  paragraph.textContent = text;
  paragraph.style.margin = "6px 0 0";
  wrapper.append(heading, paragraph);
  return wrapper;
};

const summaryRow = (label, value) => {
  const row = document.createElement("div");
  row.className = "summaryItem";
  const labelSpan = document.createElement("span");
  labelSpan.textContent = label;
  const valueSpan = document.createElement("strong");
  valueSpan.textContent = value;
  row.append(labelSpan, valueSpan);
  return row;
};

const renderStepContent = (stepId) => {
  stepContent.innerHTML = "";
  switch (stepId) {
    case "protocol":
      stepContent.appendChild(renderProtocolSelection());
      break;
    case "plan":
      stepContent.appendChild(renderPlanBuilder());
      break;
    case "checklist":
      stepContent.appendChild(renderChecklist());
      break;
    case "uploads":
      stepContent.appendChild(renderUploads());
      break;
    case "summary":
      stepContent.appendChild(renderSummary());
      break;
    default:
      stepContent.appendChild(
        createParagraph("Unknown", "No content for this step."),
      );
  }
};

const updateButtons = () => {
  const isFirst = state.currentStepIndex === 0;
  const isLast = state.currentStepIndex === steps.length - 1;

  fallbackBackButton.disabled = isFirst;
  fallbackNextButton.textContent = isLast ? "Finish" : "Next";

  if (backButton) {
    if (isFirst) {
      backButton.hide();
    } else {
      backButton.show();
    }
  }

  if (mainButton) {
    mainButton.setParams({
      text: isLast ? "Finish" : "Next",
      is_visible: true,
      color: webApp?.themeParams?.button_color,
      text_color: webApp?.themeParams?.button_text_color,
    });
  }
};

const moveToStep = (nextIndex) => {
  if (nextIndex < 0 || nextIndex >= steps.length) {
    return;
  }

  const currentStep = steps[state.currentStepIndex];
  const nextStep = steps[nextIndex];

  if (currentStep && nextIndex !== state.currentStepIndex) {
    logStep(currentStep, "finished");
  }

  state.currentStepIndex = nextIndex;
  render();

  if (nextStep) {
    logStep(nextStep, "started");
  }
};

const handleNext = () => {
  if (state.currentStepIndex < steps.length - 1) {
    moveToStep(state.currentStepIndex + 1);
  } else {
    logStep(steps[state.currentStepIndex], "finished");
    const finishedAt = new Date().toISOString();
    postJson("/api/runs", {
      ...buildRunPayload(),
      status: "completed",
      finishedAt,
    }).catch((error) => {
      console.warn("Failed to finalize run.", error);
    });
    if (webApp?.HapticFeedback) {
      webApp.HapticFeedback.notificationOccurred("success");
    }
  }
};

const handleBack = () => {
  if (state.currentStepIndex > 0) {
    moveToStep(state.currentStepIndex - 1);
  }
};

const render = () => {
  const step = steps[state.currentStepIndex];
  stepKicker.textContent = `Step ${state.currentStepIndex + 1} of ${steps.length}`;
  stepTitle.textContent = step.title;
  stepDescription.textContent = step.description;

  renderStepList();
  renderStepContent(step.id);
  updateProgress();
  updateButtons();
};

fallbackNextButton.addEventListener("click", handleNext);
fallbackBackButton.addEventListener("click", handleBack);

if (mainButton) {
  mainButton.onClick(handleNext);
}

if (backButton) {
  backButton.onClick(handleBack);
}

if (webApp) {
  webApp.ready();
  webApp.expand();
}

const initializeApp = async () => {
  try {
    await loadProtocols();
  } catch (error) {
    console.warn("Failed to load protocol schemas.", error);
  }
  await sendRunPayload();
  render();
  logStep(steps[state.currentStepIndex], "started");
};

initializeApp();
