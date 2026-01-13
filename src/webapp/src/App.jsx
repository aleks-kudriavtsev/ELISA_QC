import { useEffect, useState } from "react";

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

  useEffect(() => {
    logExperimentStep("WebAppInit", "started");
    const webApp = getWebApp();

    if (webApp) {
      webApp.ready();
      webApp.expand();
      webApp.MainButton.setParams({
        text: "Начать эксперимент",
        is_visible: true
      });
      webApp.MainButton.onClick(() => {
        webApp.HapticFeedback.notificationOccurred("success");
      });
      setTheme(webApp.colorScheme ?? "unknown");
    }

    logExperimentStep("WebAppInit", "finished");
  }, []);

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
    </main>
  );
};

export default App;
