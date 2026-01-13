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

const state = {
  currentStepIndex: 0,
  selectedProtocol: "ELISA-QC-v1",
  planItems: ["Prepare plate map", "Calibrate reader"],
  checklist: {
    "Calibrate pipettes": false,
    "Prepare controls": false,
    "Verify incubation times": false,
  },
  uploads: [],
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

const protocolOptions = ["ELISA-QC-v1", "ELISA-QC-v2", "Custom schema"];

const logStep = (stepName, status) => {
  const message = {
    step: stepName,
    status,
    timestamp: new Date().toISOString(),
  };
  console.info(JSON.stringify(message));
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
  protocolOptions.forEach((option) => {
    const entry = document.createElement("option");
    entry.value = option;
    entry.textContent = option;
    if (option === state.selectedProtocol) {
      entry.selected = true;
    }
    select.appendChild(entry);
  });

  select.addEventListener("change", (event) => {
    state.selectedProtocol = event.target.value;
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

  return card;
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

  input.addEventListener("change", (event) => {
    const files = Array.from(event.target.files || []);
    state.uploads = files;
    render();
  });

  card.append(
    createParagraph("Raw exports", "Store CSV exports and plate images."),
    input,
    list,
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
    summaryRow("Protocol", state.selectedProtocol),
    summaryRow("Plan steps", `${state.planItems.length} items`),
    summaryRow("Checklist", `${checklistDone}/${checklistTotal} complete`),
    summaryRow("Uploads", `${state.uploads.length} files`),
  );

  card.append(
    createParagraph("Experiment recap", "Confirm everything before submit."),
    summaryGrid,
  );

  return card;
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
    logStep(currentStep.title, "finished");
  }

  state.currentStepIndex = nextIndex;
  render();

  if (nextStep) {
    logStep(nextStep.title, "started");
  }
};

const handleNext = () => {
  if (state.currentStepIndex < steps.length - 1) {
    moveToStep(state.currentStepIndex + 1);
  } else {
    logStep(steps[state.currentStepIndex].title, "finished");
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

render();
logStep(steps[state.currentStepIndex].title, "started");
