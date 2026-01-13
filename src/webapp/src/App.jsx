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

const App = () => {
  const [theme, setTheme] = useState("unknown");
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedProtocol, setSelectedProtocol] = useState(null);
  const activeScreen = screens[activeIndex];
  const protocolIndex = screens.findIndex((screen) => screen.id === "protocols");
  const planBuilderIndex = screens.findIndex(
    (screen) => screen.id === "planBuilder"
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
      if (activeIndex === protocolIndex && !selectedProtocol) {
        webApp.HapticFeedback?.impactOccurred("light");
        return;
      }
      setActiveIndex((prevIndex) =>
        prevIndex < screens.length - 1 ? prevIndex + 1 : 0
      );
      webApp.HapticFeedback?.impactOccurred("light");
    };

    const handleBack = () => {
      setActiveIndex((prevIndex) => Math.max(prevIndex - 1, 0));
      webApp.HapticFeedback?.impactOccurred("light");
    };

    const isOnProtocols = activeIndex === protocolIndex;
    const mainButtonLabel = isOnProtocols
      ? selectedProtocol
        ? "Продолжить"
        : "Выберите протокол"
      : activeIndex === screens.length - 1
      ? "Сначала"
      : "Далее";

    webApp.MainButton.setParams({
      text: mainButtonLabel,
      is_visible: true,
      is_active: !isOnProtocols || Boolean(selectedProtocol)
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
  }, [activeIndex, protocolIndex, selectedProtocol]);

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
            </div>
          ) : (
            <p className="app__value">Протокол еще не выбран.</p>
          )}
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
