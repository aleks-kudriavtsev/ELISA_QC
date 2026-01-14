import { useEffect, useMemo, useRef, useState } from "react";

const protocolModules = import.meta.glob("../../../protocols/elisa/*.json", {
  eager: true
});

const screens = [
  {
    id: "protocols",
    title: "Protocols",
    status: "Выберите протокол ИФА для построения плана."
  },
  {
    id: "planBuilder",
    title: "PlanBuilder",
    status: "Черновик плана ожидает подтверждения."
  },
  {
    id: "consumables",
    title: "Consumables",
    status: "Справочник расходников и текущих остатков."
  },
  {
    id: "checklist",
    title: "Checklist",
    status: "Чек-лист запущен, шаги ожидают отметок."
  },
  {
    id: "uploads",
    title: "Uploads",
    status: "Файлы можно добавить после завершения шагов."
  },
  {
    id: "summary",
    title: "Summary",
    status: "Сводка будет собрана после загрузки результатов."
  }
];

const protocolOrder = [
  "DELFIA Labeling Preparation",
  "Direct ELISA",
  "Indirect ELISA",
  "Sandwich ELISA",
  "Competitive ELISA",
  "DELFIA Eu-N1 DTA Labeling"
];

const logExperimentStep = (stepName, status) => {
  const payload = {
    stepName,
    status,
    timestamp: new Date().toISOString()
  };
  console.info(`[ExperimentStep] ${JSON.stringify(payload)}`);
};

const getWebApp = () => {
  if (typeof window === "undefined") {
    return null;
  }
  return window.Telegram?.WebApp ?? null;
};

const getProtocolLabel = (protocol) => {
  if (!protocol) {
    return "";
  }
  return (
    protocol?.properties?.name?.const ??
    protocol?.title ??
    protocol?.properties?.protocolId?.default ??
    "Протокол"
  );
};

const buildProtocolList = () =>
  Object.entries(protocolModules).map(([path, moduleData]) => {
    const schema = moduleData?.default ?? moduleData;
    return {
      id: schema?.properties?.protocolId?.default ?? path,
      name: getProtocolLabel(schema),
      description: schema?.description ?? "",
      schemaVersion: schema?.properties?.schemaVersion?.default ?? "",
      schema
    };
  });

const initialChecklistSteps = [
  {
    id: "bufferPreparation",
    title: "Подготовка буферов",
    fields: [
      {
        id: "composition",
        label: "Состав буфера",
        placeholder: "Компоненты и концентрации"
      },
      {
        id: "preparationDate",
        label: "Дата приготовления",
        placeholder: "YYYY-MM-DD"
      },
      {
        id: "expirationDate",
        label: "Срок годности",
        placeholder: "YYYY-MM-DD"
      },
      {
        id: "lotNumber",
        label: "Партия",
        placeholder: "Например, BUF-2024-05"
      }
    ],
    confirmationLabel: "Буферы подготовлены"
  },
  {
    id: "phCheck",
    title: "Проверка pH",
    fields: [
      {
        id: "ph",
        label: "pH",
        placeholder: "Например, 7.4",
        dataType: "number"
      }
    ],
    confirmationLabel: "pH подтвержден"
  },
  {
    id: "storageCheck",
    title: "Партии и условия хранения",
    fields: [
      {
        id: "lotNumber",
        label: "Партия",
        placeholder: "Например, BUF-2024-05"
      },
      {
        id: "storageConditions",
        label: "Условия хранения",
        placeholder: "Например, 2-8°C, темнота"
      }
    ],
    confirmationLabel: "Партии и условия хранения проверены"
  },
  {
    id: "samplePreparation",
    title: "Подготовка образцов",
    fields: [
      {
        id: "operatorName",
        label: "Ответственный",
        placeholder: "ФИО исполнителя"
      }
    ],
    confirmationLabel: "Подтверждаю готовность образцов"
  },
  {
    id: "reagentDilution",
    title: "Разведение реагентов",
    fields: [
      {
        id: "reagentLotNumber",
        label: "Партия реагентов",
        placeholder: "Например, RN-2024-11"
      },
      {
        id: "antibodyLotNumber",
        label: "Партия антител",
        placeholder: "Например, AB-2024-09"
      },
      {
        id: "bufferLotNumber",
        label: "Партия буфера",
        placeholder: "Например, BF-2024-07"
      },
      {
        id: "dilutionRatio",
        label: "Коэффициент разведения",
        placeholder: "Например, 1:200"
      }
    ],
    confirmationLabel: "Проверил правильность разведения"
  },
  {
    id: "plateSetup",
    title: "Настройка планшета",
    fields: [
      {
        id: "incubationTemperature",
        label: "Температура инкубации",
        placeholder: "°C"
      }
    ],
    confirmationLabel: "Планшет подготовлен и подписан"
  }
];

const buildChecklistState = (steps = initialChecklistSteps) =>
  steps.map((step) => ({
    ...step,
    values: step.fields.reduce((accumulator, field) => {
      return { ...accumulator, [field.id]: "" };
    }, {}),
    isConfirmed: false,
    status: "pending"
  }));

const buildProtocolChecklistSteps = (protocol) => {
  const stepSchemas = protocol?.schema?.properties?.steps?.prefixItems;
  if (!Array.isArray(stepSchemas)) {
    return null;
  }

  return stepSchemas.map((stepSchema, index) => {
    const stepId = stepSchema?.properties?.id?.const ?? `step-${index + 1}`;
    const title =
      stepSchema?.properties?.name?.const ??
      stepSchema?.title ??
      `Шаг ${index + 1}`;
    const uiConfig = stepSchema?.["x-ui"] ?? {};
    const fields = (uiConfig.fields ?? []).map((field) => ({
      id: field.id,
      label: field.label,
      placeholder: field.placeholder ?? "",
      unit: field.unit ?? "",
      dataType: field.dataType ?? "string"
    }));

    return {
      id: stepId,
      title,
      fields,
      confirmationLabel:
        uiConfig.confirmationLabel ?? "Подтверждаю выполнение шага"
    };
  });
};

const evaluateChecklistStatus = (step) => {
  const hasInput = step.fields.some(
    (field) => step.values[field.id].trim() !== ""
  );
  const allFieldsFilled = step.fields.every(
    (field) => step.values[field.id].trim() !== ""
  );
  if (allFieldsFilled && step.isConfirmed) {
    return "finished";
  }
  if (hasInput || step.isConfirmed) {
    return "started";
  }
  return "pending";
};

const initialConsumables = [
  {
    id: "consumable-1",
    name: "96-луночные планшеты",
    unit: "шт",
    onHand: 12,
    reorderThreshold: 4,
    plannedUse: 2,
    used: 0
  },
  {
    id: "consumable-2",
    name: "Пипеточные наконечники",
    unit: "шт",
    onHand: 480,
    reorderThreshold: 200,
    plannedUse: 96,
    used: 0
  },
  {
    id: "consumable-3",
    name: "Промывочный буфер",
    unit: "мл",
    onHand: 250,
    reorderThreshold: 80,
    plannedUse: 120,
    used: 0
  }
];

const buildConsumableWarnings = (consumables) =>
  consumables.flatMap((consumable) => {
    const warnings = [];
    if (consumable.plannedUse > consumable.onHand) {
      warnings.push({
        id: `${consumable.id}-shortage`,
        type: "shortage",
        message: `${consumable.name}: нужно ${consumable.plannedUse} ${consumable.unit}, доступно ${consumable.onHand} ${consumable.unit}.`
      });
    }
    if (
      consumable.reorderThreshold > 0 &&
      consumable.onHand <= consumable.reorderThreshold
    ) {
      warnings.push({
        id: `${consumable.id}-low`,
        type: "low",
        message: `${consumable.name}: остаток ${consumable.onHand} ${consumable.unit} близок к порогу пополнения (${consumable.reorderThreshold} ${consumable.unit}).`
      });
    }
    return warnings;
  });

const formatConsumableStatus = (consumable) => {
  if (consumable.plannedUse > consumable.onHand) {
    return { label: "Нехватка", tone: "alert" };
  }
  if (
    consumable.reorderThreshold > 0 &&
    consumable.onHand <= consumable.reorderThreshold
  ) {
    return { label: "Низкий остаток", tone: "warning" };
  }
  return { label: "Достаточно", tone: "ok" };
};

const App = () => {
  const [theme, setTheme] = useState("unknown");
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedProtocol, setSelectedProtocol] = useState(null);
  const [checklistSteps, setChecklistSteps] = useState(() =>
    buildChecklistState()
  );
  const [consumables, setConsumables] = useState(() => initialConsumables);
  const [consumptionLogs, setConsumptionLogs] = useState([]);
  const [consumableForm, setConsumableForm] = useState({
    name: "",
    unit: "шт",
    onHand: "",
    reorderThreshold: "",
    plannedUse: ""
  });
  const consumableSequence = useRef(initialConsumables.length);
  const activeScreen = screens[activeIndex];
  const protocolIndex = screens.findIndex((screen) => screen.id === "protocols");
  const planBuilderIndex = screens.findIndex(
    (screen) => screen.id === "planBuilder"
  );
  const consumablesIndex = screens.findIndex(
    (screen) => screen.id === "consumables"
  );
  const checklistIndex = screens.findIndex((screen) => screen.id === "checklist");
  const uploadsIndex = screens.findIndex((screen) => screen.id === "uploads");
  const summaryIndex = screens.findIndex((screen) => screen.id === "summary");
  const consumableWarnings = useMemo(
    () => buildConsumableWarnings(consumables),
    [consumables]
  );
  const protocolChecklistSteps = useMemo(
    () => buildProtocolChecklistSteps(selectedProtocol),
    [selectedProtocol]
  );

  const protocols = useMemo(() => {
    const list = buildProtocolList();
    return list.sort((first, second) => {
      const firstIndex = protocolOrder.indexOf(first.name);
      const secondIndex = protocolOrder.indexOf(second.name);
      if (firstIndex === -1 && secondIndex === -1) {
        return first.name.localeCompare(second.name);
      }
      if (firstIndex === -1) {
        return 1;
      }
      if (secondIndex === -1) {
        return -1;
      }
      return firstIndex - secondIndex;
    });
  }, []);

  useEffect(() => {
    logExperimentStep("WebAppInit", "started");
    const webApp = getWebApp();

    if (webApp) {
      webApp.ready();
      webApp.expand();
      webApp.MainButton.setParams({
        text: "Далее",
        is_visible: true
      });
      setTheme(webApp.colorScheme ?? "unknown");
    }

    logExperimentStep("WebAppInit", "finished");
  }, []);

  useEffect(() => {
    if (protocolChecklistSteps?.length) {
      setChecklistSteps(buildChecklistState(protocolChecklistSteps));
      return;
    }
    setChecklistSteps(buildChecklistState());
  }, [protocolChecklistSteps]);

  useEffect(() => {
    if (!activeScreen) {
      return undefined;
    }

    logExperimentStep(`Screen:${activeScreen.title}`, "started");
    return () => {
      logExperimentStep(`Screen:${activeScreen.title}`, "finished");
    };
  }, [activeScreen.title]);

  useEffect(() => {
    const webApp = getWebApp();
    if (!webApp) {
      return undefined;
    }

    const handleNext = () => {
      if (activeIndex === protocolIndex) {
        if (!selectedProtocol) {
          webApp.HapticFeedback?.impactOccurred("light");
          return;
        }
        setActiveIndex(planBuilderIndex);
        webApp.HapticFeedback?.impactOccurred("light");
        return;
      }
      if (activeIndex === planBuilderIndex) {
        setActiveIndex(consumablesIndex);
        webApp.HapticFeedback?.impactOccurred("light");
        return;
      }
      if (activeIndex === consumablesIndex) {
        setActiveIndex(checklistIndex);
        if (consumableWarnings.length > 0) {
          webApp.HapticFeedback?.notificationOccurred("warning");
        } else {
          webApp.HapticFeedback?.impactOccurred("light");
        }
        return;
      }
      if (activeIndex === checklistIndex) {
        const isChecklistComplete = checklistSteps.every(
          (step) => step.status === "finished"
        );
        if (!isChecklistComplete) {
          webApp.HapticFeedback?.impactOccurred("light");
          return;
        }
        setActiveIndex(uploadsIndex);
        webApp.HapticFeedback?.impactOccurred("light");
        return;
      }
      if (activeIndex === uploadsIndex) {
        setActiveIndex(summaryIndex);
        webApp.HapticFeedback?.impactOccurred("light");
        return;
      }
      if (activeIndex === summaryIndex) {
        setActiveIndex(protocolIndex);
        webApp.HapticFeedback?.impactOccurred("light");
        return;
      }
    };

    const handleBack = () => {
      setActiveIndex((prevIndex) => Math.max(prevIndex - 1, 0));
      webApp.HapticFeedback?.impactOccurred("light");
    };

    const isOnProtocols = activeIndex === protocolIndex;
    const isOnConsumables = activeIndex === consumablesIndex;
    const isOnChecklist = activeIndex === checklistIndex;
    const isChecklistComplete = checklistSteps.every(
      (step) => step.status === "finished"
    );
    let mainButtonLabel = "Далее";
    if (isOnProtocols) {
      mainButtonLabel = selectedProtocol ? "Продолжить" : "Выберите протокол";
    } else if (activeIndex === planBuilderIndex) {
      mainButtonLabel = "К расходникам";
    } else if (isOnConsumables) {
      mainButtonLabel =
        consumableWarnings.length > 0 ? "Проверьте остатки" : "К чек-листу";
    } else if (isOnChecklist) {
      mainButtonLabel = isChecklistComplete
        ? "К загрузкам"
        : "Заполните чек-лист";
    } else if (activeIndex === uploadsIndex) {
      mainButtonLabel = "К сводке";
    } else if (activeIndex === summaryIndex) {
      mainButtonLabel = "Сначала";
    }

    webApp.MainButton.setParams({
      text: mainButtonLabel,
      is_visible: true,
      is_active:
        (!isOnProtocols || Boolean(selectedProtocol)) &&
        (!isOnChecklist || isChecklistComplete)
    });

    if (activeIndex === 0) {
      webApp.BackButton.hide();
    } else {
      webApp.BackButton.show();
    }

    webApp.MainButton.onClick(handleNext);
    webApp.BackButton.onClick(handleBack);

    return () => {
      webApp.MainButton.offClick(handleNext);
      webApp.BackButton.offClick(handleBack);
    };
  }, [
    activeIndex,
    checklistIndex,
    checklistSteps,
    consumablesIndex,
    consumableWarnings.length,
    planBuilderIndex,
    protocolIndex,
    selectedProtocol,
    summaryIndex,
    uploadsIndex
  ]);

  const handleSelectScreen = (index) => {
    setActiveIndex(index);
    const webApp = getWebApp();
    webApp?.HapticFeedback.selectionChanged();
  };

  const handleSelectProtocol = (protocol) => {
    if (!protocol) {
      return;
    }
    logExperimentStep(`ProtocolSelect:${protocol.name}`, "started");
    setSelectedProtocol(protocol);
    setActiveIndex(planBuilderIndex);
    const webApp = getWebApp();
    webApp?.HapticFeedback.selectionChanged();
    logExperimentStep(`ProtocolSelect:${protocol.name}`, "finished");
  };

  const handleStartExperiment = () => {
    logExperimentStep("StartExperiment", "started");
    setActiveIndex(consumablesIndex);
    const webApp = getWebApp();
    webApp?.HapticFeedback.impactOccurred("light");
    logExperimentStep("StartExperiment", "finished");
  };

  const updateChecklistStep = (stepId, updater) => {
    setChecklistSteps((prevSteps) =>
      prevSteps.map((step) => {
        if (step.id !== stepId) {
          return step;
        }
        const nextStep = updater(step);
        const nextStatus = evaluateChecklistStatus(nextStep);
        if (nextStatus !== step.status) {
          const logStatus =
            step.status === "finished" && nextStatus !== "finished"
              ? "failed"
              : nextStatus;
          if (logStatus !== "pending") {
            logExperimentStep(`Checklist:${step.title}`, logStatus);
          }
        }
        return { ...nextStep, status: nextStatus };
      })
    );
  };

  const handleChecklistFieldChange = (stepId, fieldId, value) => {
    updateChecklistStep(stepId, (step) => ({
      ...step,
      values: { ...step.values, [fieldId]: value }
    }));
  };

  const handleChecklistConfirmation = (stepId, isConfirmed) => {
    updateChecklistStep(stepId, (step) => ({
      ...step,
      isConfirmed
    }));
  };

  const handleGoToUploads = () => {
    const isChecklistComplete = checklistSteps.every(
      (step) => step.status === "finished"
    );
    if (!isChecklistComplete) {
      return;
    }
    setActiveIndex(uploadsIndex);
    const webApp = getWebApp();
    webApp?.HapticFeedback.impactOccurred("light");
  };

  const handleConsumableFormChange = (field, value) => {
    setConsumableForm((prevForm) => ({ ...prevForm, [field]: value }));
  };

  const handleAddConsumable = () => {
    if (!consumableForm.name.trim()) {
      return;
    }
    consumableSequence.current += 1;
    const nextConsumable = {
      id: `consumable-${consumableSequence.current}`,
      name: consumableForm.name.trim(),
      unit: consumableForm.unit.trim() || "шт",
      onHand: Number.parseFloat(consumableForm.onHand) || 0,
      reorderThreshold: Number.parseFloat(consumableForm.reorderThreshold) || 0,
      plannedUse: Number.parseFloat(consumableForm.plannedUse) || 0,
      used: 0
    };
    setConsumables((prevConsumables) => [...prevConsumables, nextConsumable]);
    logExperimentStep(`Consumable:Add:${nextConsumable.name}`, "finished");
    setConsumableForm({
      name: "",
      unit: "шт",
      onHand: "",
      reorderThreshold: "",
      plannedUse: ""
    });
  };

  const handleConsumableFieldChange = (consumableId, field, value) => {
    setConsumables((prevConsumables) =>
      prevConsumables.map((consumable) => {
        if (consumable.id !== consumableId) {
          return consumable;
        }
        return {
          ...consumable,
          [field]:
            field === "name" || field === "unit"
              ? value
              : Math.max(0, Number.parseFloat(value) || 0)
        };
      })
    );
  };

  const handleConsumableUsageChange = (consumableId, value) => {
    const timestamp = new Date().toISOString();
    let logEntry = null;
    let stepName = null;
    setConsumables((prevConsumables) =>
      prevConsumables.map((consumable) => {
        if (consumable.id !== consumableId) {
          return consumable;
        }
        const nextUsed = Math.max(0, Number.parseFloat(value) || 0);
        const delta = nextUsed - consumable.used;
        if (delta > 0) {
          logEntry = {
            id: `${consumableId}-${timestamp}`,
            consumableId,
            name: consumable.name,
            quantity: delta,
            unit: consumable.unit,
            timestamp,
            status: "logged"
          };
          stepName = `Consumable:${consumable.name}`;
        }
        return { ...consumable, used: nextUsed };
      })
    );
    if (logEntry) {
      setConsumptionLogs((prevLogs) => [...prevLogs, logEntry]);
      logExperimentStep(stepName, "finished");
    }
  };

  const handleGoToSummary = () => {
    setActiveIndex(summaryIndex);
    const webApp = getWebApp();
    webApp?.HapticFeedback.impactOccurred("light");
  };

  return (
    <main className="app">
      <header className="app__header">
        <p className="app__eyebrow">ELISA · Telegram WebApp</p>
        <h1 className="app__title">Лабораторный контроль ИФА</h1>
      </header>
      <section className="app__card">
        <p className="app__label">Статус подключения SDK</p>
        <p className="app__value">
          {theme === "unknown"
            ? "Telegram WebApp не обнаружен"
            : `Тема: ${theme}`}
        </p>
        <p className="app__hint">
          Основная кнопка и тактильная отдача управляются через Telegram WebApp
          SDK.
        </p>
      </section>
      <section className="app__card">
        <p className="app__label">Навигация</p>
        <nav className="app__nav" aria-label="Маршруты">
          {screens.map((screen, index) => (
            <button
              key={screen.id}
              type="button"
              className={`app__nav-button${
                index === activeIndex ? " is-active" : ""
              }`}
              onClick={() => handleSelectScreen(index)}
            >
              <span className="app__nav-title">{screen.title}</span>
              <span className="app__nav-status">
                {index === activeIndex ? "Активно" : "Перейти"}
              </span>
            </button>
          ))}
        </nav>
      </section>
      {activeScreen.id === "protocols" && (
        <section className="app__card">
          <p className="app__label">Протоколы ELISA/DELFIA</p>
          <div className="app__protocols">
            {protocols.map((protocol) => (
              <button
                key={protocol.id}
                type="button"
                className="app__protocol"
                onClick={() => handleSelectProtocol(protocol)}
              >
                <span className="app__protocol-name">{protocol.name}</span>
                <span className="app__protocol-meta">
                  {protocol.description}
                </span>
              </button>
            ))}
          </div>
          <p className="app__hint">
            После выбора протокола вы перейдете к сборке плана.
          </p>
        </section>
      )}
      {activeScreen.id === "planBuilder" && (
        <section className="app__card">
          <p className="app__label">Выбранный протокол</p>
          {selectedProtocol ? (
            <div className="app__protocol-summary">
              <h2 className="app__screen-title">{selectedProtocol.name}</h2>
              <p className="app__value">{selectedProtocol.description}</p>
              <p className="app__hint">
                Версия схемы: {selectedProtocol.schemaVersion}
              </p>
              {protocolChecklistSteps?.length ? (
                <div className="app__protocol-breakdown">
                  <p className="app__label">Контрольные этапы протокола</p>
                  <ol className="app__step-list">
                    {protocolChecklistSteps.map((step) => (
                      <li key={step.id} className="app__step-item">
                        <div className="app__step-title">{step.title}</div>
                        {step.fields.length > 0 && (
                          <div className="app__step-fields">
                            {step.fields.map((field) => (
                              <span key={field.id} className="app__chip">
                                {field.label}
                                {field.unit ? ` (${field.unit})` : ""}
                              </span>
                            ))}
                          </div>
                        )}
                      </li>
                    ))}
                  </ol>
                </div>
              ) : (
                <p className="app__hint">
                  Для выбранного протокола используется базовый чек-лист.
                </p>
              )}
              <button
                type="button"
                className="app__action-button"
                onClick={handleStartExperiment}
              >
                Перейти к расходникам
              </button>
            </div>
          ) : (
            <p className="app__value">Протокол еще не выбран.</p>
          )}
        </section>
      )}
      {activeScreen.id === "consumables" && (
        <section className="app__card">
          <p className="app__label">Справочник расходников</p>
          <div className="app__consumables">
            {consumables.map((consumable) => {
              const status = formatConsumableStatus(consumable);
              return (
                <div key={consumable.id} className="app__consumable-card">
                  <div className="app__consumable-header">
                    <input
                      className="app__input app__input--name"
                      type="text"
                      value={consumable.name}
                      onChange={(event) =>
                        handleConsumableFieldChange(
                          consumable.id,
                          "name",
                          event.target.value
                        )
                      }
                    />
                    <span
                      className={`app__badge app__badge--${status.tone}`}
                    >
                      {status.label}
                    </span>
                  </div>
                  <div className="app__consumable-grid">
                    <label className="app__field">
                      <span className="app__field-label">Остаток</span>
                      <input
                        className="app__input"
                        type="number"
                        min="0"
                        value={consumable.onHand}
                        onChange={(event) =>
                          handleConsumableFieldChange(
                            consumable.id,
                            "onHand",
                            event.target.value
                          )
                        }
                      />
                    </label>
                    <label className="app__field">
                      <span className="app__field-label">План на run</span>
                      <input
                        className="app__input"
                        type="number"
                        min="0"
                        value={consumable.plannedUse}
                        onChange={(event) =>
                          handleConsumableFieldChange(
                            consumable.id,
                            "plannedUse",
                            event.target.value
                          )
                        }
                      />
                    </label>
                    <label className="app__field">
                      <span className="app__field-label">Порог пополнения</span>
                      <input
                        className="app__input"
                        type="number"
                        min="0"
                        value={consumable.reorderThreshold}
                        onChange={(event) =>
                          handleConsumableFieldChange(
                            consumable.id,
                            "reorderThreshold",
                            event.target.value
                          )
                        }
                      />
                    </label>
                    <label className="app__field">
                      <span className="app__field-label">Потреблено</span>
                      <input
                        className="app__input"
                        type="number"
                        min="0"
                        value={consumable.used}
                        onChange={(event) =>
                          handleConsumableUsageChange(
                            consumable.id,
                            event.target.value
                          )
                        }
                      />
                    </label>
                    <label className="app__field">
                      <span className="app__field-label">Ед.</span>
                      <input
                        className="app__input"
                        type="text"
                        value={consumable.unit}
                        onChange={(event) =>
                          handleConsumableFieldChange(
                            consumable.id,
                            "unit",
                            event.target.value
                          )
                        }
                      />
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
          {consumableWarnings.length > 0 && (
            <div className="app__warning">
              <strong>Предупреждения по остаткам</strong>
              <ul className="app__warning-list">
                {consumableWarnings.map((warning) => (
                  <li key={warning.id}>{warning.message}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="app__consumable-form">
            <p className="app__label">Добавить расходник</p>
            <div className="app__consumable-grid">
              <label className="app__field">
                <span className="app__field-label">Название</span>
                <input
                  className="app__input"
                  type="text"
                  value={consumableForm.name}
                  onChange={(event) =>
                    handleConsumableFormChange("name", event.target.value)
                  }
                />
              </label>
              <label className="app__field">
                <span className="app__field-label">Ед.</span>
                <input
                  className="app__input"
                  type="text"
                  value={consumableForm.unit}
                  onChange={(event) =>
                    handleConsumableFormChange("unit", event.target.value)
                  }
                />
              </label>
              <label className="app__field">
                <span className="app__field-label">Остаток</span>
                <input
                  className="app__input"
                  type="number"
                  min="0"
                  value={consumableForm.onHand}
                  onChange={(event) =>
                    handleConsumableFormChange("onHand", event.target.value)
                  }
                />
              </label>
              <label className="app__field">
                <span className="app__field-label">Порог пополнения</span>
                <input
                  className="app__input"
                  type="number"
                  min="0"
                  value={consumableForm.reorderThreshold}
                  onChange={(event) =>
                    handleConsumableFormChange(
                      "reorderThreshold",
                      event.target.value
                    )
                  }
                />
              </label>
              <label className="app__field">
                <span className="app__field-label">План на run</span>
                <input
                  className="app__input"
                  type="number"
                  min="0"
                  value={consumableForm.plannedUse}
                  onChange={(event) =>
                    handleConsumableFormChange("plannedUse", event.target.value)
                  }
                />
              </label>
            </div>
            <button
              type="button"
              className="app__action-button"
              onClick={handleAddConsumable}
            >
              Добавить в справочник
            </button>
          </div>
        </section>
      )}
      {activeScreen.id === "checklist" && (
        <section className="app__card">
          <p className="app__label">Checklist эксперимента</p>
          {consumableWarnings.length > 0 && (
            <div className="app__warning">
              <strong>Перед стартом проверьте остатки</strong>
              <ul className="app__warning-list">
                {consumableWarnings.map((warning) => (
                  <li key={warning.id}>{warning.message}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="app__checklist">
            {checklistSteps.map((step, index) => {
              const isComplete = step.status === "finished";
              return (
                <div
                  key={step.id}
                  className={`app__checklist-step${
                    isComplete ? " is-complete" : ""
                  }`}
                >
                  <div className="app__checklist-header">
                    <div>
                      <p className="app__checklist-index">Шаг {index + 1}</p>
                      <h3 className="app__checklist-title">{step.title}</h3>
                    </div>
                    <span className="app__checklist-status">
                      {isComplete ? "Готово" : "Ожидает"}
                    </span>
                  </div>
                  <div className="app__checklist-fields">
                    {step.fields.map((field) => (
                    <label
                      key={field.id}
                      className="app__field"
                      htmlFor={`${step.id}-${field.id}`}
                    >
                        <span className="app__field-label">
                          {field.label}
                          {field.unit ? ` (${field.unit})` : ""}
                        </span>
                        <input
                          id={`${step.id}-${field.id}`}
                          className="app__input"
                          type={field.dataType === "number" ? "number" : "text"}
                          placeholder={field.placeholder}
                          value={step.values[field.id]}
                          onChange={(event) =>
                            handleChecklistFieldChange(
                              step.id,
                              field.id,
                              event.target.value
                            )
                          }
                          required
                        />
                      </label>
                    ))}
                  </div>
                  <label className="app__checkbox">
                    <input
                      type="checkbox"
                      checked={step.isConfirmed}
                      onChange={(event) =>
                        handleChecklistConfirmation(step.id, event.target.checked)
                      }
                      required
                    />
                    <span>{step.confirmationLabel}</span>
                  </label>
                </div>
              );
            })}
          </div>
          <button
            type="button"
            className="app__action-button"
            onClick={handleGoToUploads}
            disabled={!checklistSteps.every((step) => step.status === "finished")}
          >
            Перейти к загрузкам
          </button>
          <p className="app__hint">
            Заполните все поля и подтвердите шаги, чтобы перейти к загрузке.
          </p>
        </section>
      )}
      {activeScreen.id === "uploads" && (
        <section className="app__card">
          <p className="app__label">Загрузка данных</p>
          <p className="app__value">Добавьте файлы измерений и фото планшета.</p>
          <button
            type="button"
            className="app__action-button"
            onClick={handleGoToSummary}
          >
            Перейти к сводке
          </button>
          <p className="app__hint">
            После загрузки данные будут доступны в итоговой сводке.
          </p>
        </section>
      )}
      {activeScreen.id === "summary" && (
        <section className="app__card">
          <p className="app__label">Summary</p>
          <p className="app__value">
            Здесь появится итоговая сводка эксперимента и журнал действий.
          </p>
          <div className="app__consumption-log">
            <p className="app__label">Лог расходников в ходе run</p>
            {consumptionLogs.length === 0 ? (
              <p className="app__hint">Пока нет записей о потреблении.</p>
            ) : (
              <ul className="app__log-list">
                {consumptionLogs.map((entry) => (
                  <li key={entry.id}>
                    {entry.timestamp} — {entry.name}: {entry.quantity}{" "}
                    {entry.unit}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}
      <section className="app__card">
        <p className="app__label">Текущий экран</p>
        <h2 className="app__screen-title">{activeScreen.title}</h2>
        <p className="app__value">{activeScreen.status}</p>
        <p className="app__hint">
          Переключайтесь между шагами через меню или кнопки Telegram.
        </p>
      </section>
    </main>
  );
};

export default App;
