import { useEffect, useMemo, useState } from "react";

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
  "Direct ELISA",
  "Indirect ELISA",
  "Sandwich ELISA",
  "Competitive ELISA"
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
        id: "batchNumber",
        label: "Номер партии реагентов",
        placeholder: "Например, RN-2024-11"
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

const buildChecklistState = () =>
  initialChecklistSteps.map((step) => ({
    ...step,
    values: step.fields.reduce((accumulator, field) => {
      return { ...accumulator, [field.id]: "" };
    }, {}),
    isConfirmed: false,
    status: "pending"
  }));

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

const App = () => {
  const [theme, setTheme] = useState("unknown");
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedProtocol, setSelectedProtocol] = useState(null);
  const [checklistSteps, setChecklistSteps] = useState(buildChecklistState);
  const activeScreen = screens[activeIndex];
  const protocolIndex = screens.findIndex((screen) => screen.id === "protocols");
  const planBuilderIndex = screens.findIndex(
    (screen) => screen.id === "planBuilder"
  );
  const checklistIndex = screens.findIndex((screen) => screen.id === "checklist");
  const uploadsIndex = screens.findIndex((screen) => screen.id === "uploads");
  const summaryIndex = screens.findIndex((screen) => screen.id === "summary");

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
        setActiveIndex(checklistIndex);
        webApp.HapticFeedback?.impactOccurred("light");
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
    const isOnChecklist = activeIndex === checklistIndex;
    const isChecklistComplete = checklistSteps.every(
      (step) => step.status === "finished"
    );
    let mainButtonLabel = "Далее";
    if (isOnProtocols) {
      mainButtonLabel = selectedProtocol ? "Продолжить" : "Выберите протокол";
    } else if (activeIndex === planBuilderIndex) {
      mainButtonLabel = "Начать эксперимент";
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
    setActiveIndex(checklistIndex);
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
          <p className="app__label">Протоколы ELISA</p>
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
              <button
                type="button"
                className="app__action-button"
                onClick={handleStartExperiment}
              >
                Начать эксперимент
              </button>
            </div>
          ) : (
            <p className="app__value">Протокол еще не выбран.</p>
          )}
        </section>
      )}
      {activeScreen.id === "checklist" && (
        <section className="app__card">
          <p className="app__label">Checklist эксперимента</p>
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
                        <span className="app__field-label">{field.label}</span>
                        <input
                          id={`${step.id}-${field.id}`}
                          className="app__input"
                          type="text"
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
