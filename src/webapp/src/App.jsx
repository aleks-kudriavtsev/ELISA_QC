import { useEffect, useState } from "react";

const screens = [
  {
    id: "protocols",
    title: "Protocols",
    status: "Готово к выбору протокола и параметров."
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

const App = () => {
  const [theme, setTheme] = useState("unknown");
  const [activeIndex, setActiveIndex] = useState(0);
  const activeScreen = screens[activeIndex];

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
      setActiveIndex((prevIndex) =>
        prevIndex < screens.length - 1 ? prevIndex + 1 : 0
      );
      webApp.HapticFeedback?.impactOccurred("light");
    };

    const handleBack = () => {
      setActiveIndex((prevIndex) => Math.max(prevIndex - 1, 0));
      webApp.HapticFeedback?.impactOccurred("light");
    };

    webApp.MainButton.setParams({
      text: activeIndex === screens.length - 1 ? "Сначала" : "Далее",
      is_visible: true
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
  }, [activeIndex]);

  const handleSelectScreen = (index) => {
    setActiveIndex(index);
    const webApp = getWebApp();
    webApp?.HapticFeedback.selectionChanged();
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
