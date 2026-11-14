import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { t } from "@/i18n";
import { clearSave } from "@/session/storage";
import "./ErrorBoundary.css";

type State = { failed: boolean };

// Ошибка в любом компоненте не должна оставлять белый экран: показываем понятное сообщение и два выхода.
// Сохранение одиночной игры не удаляем сами: «Сбросить сохранение» нужно на случай, если сломало именно оно
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Ошибка в интерфейсе", error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="error-screen" role="alert">
        <h1>{t("error.title")}</h1>
        <p>{t("error.text")}</p>
        <div className="error-screen__actions">
          <button className="btn btn--choice" onClick={() => location.reload()}>
            {t("error.reload")}
          </button>
          <button
            className="btn btn--ghost"
            onClick={() => {
              clearSave();
              location.reload();
            }}
          >
            {t("error.reset")}
          </button>
        </div>
      </div>
    );
  }
}
