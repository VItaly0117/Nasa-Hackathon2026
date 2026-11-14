import { useMemo } from "react";
import hintsData from "../data/hints.json";
import { buildReport, missionFact } from "../engine/debrief";
import type { DebriefLine } from "../engine/debrief";
import type { GameRecord } from "../engine/storage";
import { days as daysText, t } from "../i18n";
import type { GameState } from "../types";
import { Rocket } from "./Prologue";
import "./ResultsScreen.css";

const HINTS = hintsData as { id: string; source?: string }[];

type Props = {
  state: GameState;
  online: boolean;
  // Лучший результат одиночных игр. isNew: этот результат лучше прежних
  record: { best: GameRecord; isNew: boolean } | null;
  onRestart: () => void;
  onMenu: () => void;
  onSources: () => void;
};

function Lines({ lines, kind }: { lines: DebriefLine[]; kind: "helped" | "hurt" | "facts" }) {
  return (
    <ul className={`results__list results__list--${kind}`}>
      {lines.map((line) => (
        <li key={line.id}>
          <span>
            {line.text}
            {line.source && (
              <>
                {" "}
                <a href={line.source.url} target="_blank" rel="noreferrer">
                  {line.source.label}
                </a>
              </>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}

function recordText(rec: GameRecord) {
  return t(rec.won ? "results.record.won" : "results.record.lost", { days: daysText(rec.days), health: rec.health });
}

// Итоговый экран: чем кончилась миссия, что помогло и помешало, и что об этом знает NASA
export function ResultsScreen({ state, online, record, onRestart, onMenu, onSources }: Props) {
  const report = useMemo(() => buildReport(state), [state]);
  const fact = missionFact(state);

  // Подсказки «как это у NASA» к тем пунктам разбора, у которых она есть (не больше двух)
  const hintIds = [...new Set([...report.hurt, ...report.helped].map((l) => l.hintId).filter((id): id is string => !!id))].slice(0, 2);

  return (
    <div className="overlay">
      <div className={`modal ending results ending--${state.status}`}>
        {report.won && <Rocket className="ending__rocket" flame />}
        <h2>{report.title}</h2>
        <p className="results__rating">{t("results.rating", { rating: report.rating })}</p>
        <p>{report.summary}</p>
        <p className="muted results__stats">
          {t("app.daysOnMoon", { n: report.days })} · {t("results.health", { n: report.health })}
        </p>
        {record && (
          <p className="results__record">
            {record.isNew && <strong>{t("results.record.new")} </strong>}
            {t("results.record.best", { result: recordText(record.best) })}
          </p>
        )}

        {report.hurt.length > 0 && (
          <section className="results__section">
            <h3>{t("debrief.hurt")}</h3>
            <Lines lines={report.hurt} kind="hurt" />
          </section>
        )}
        {report.helped.length > 0 && (
          <section className="results__section">
            <h3>{t("debrief.helped")}</h3>
            <Lines lines={report.helped} kind="helped" />
          </section>
        )}
        {report.facts.length > 0 && (
          <section className="results__section">
            <h3>{t("debrief.facts")}</h3>
            <Lines lines={report.facts} kind="facts" />
          </section>
        )}

        <section className="results__section">
          <h3>{t("results.how")}</h3>
          <div className="results__cards">
            {hintIds.map((id) => (
              <div key={id} className="results__card">
                <p>{t(`hint.${id}`)}</p>
                {HINTS.find((h) => h.id === id)?.source && (
                  <small>{t("results.source", { name: HINTS.find((h) => h.id === id)!.source! })}</small>
                )}
              </div>
            ))}
            <div className="results__card">
              <strong>{t("results.factTitle")}</strong>
              <p>{t(`fact.${fact.id}`)}</p>
              {fact.source && <small>{t("results.source", { name: fact.source })}</small>}
            </div>
          </div>
        </section>

        <p className="results__links">
          <button className="btn btn--ghost btn--small" onClick={onSources}>
            {t("results.sources")}
          </button>
        </p>

        <div className="modal__choices">
          {!online && (
            <button className="btn btn--primary" onClick={onRestart}>
              {t("app.playAgain")}
            </button>
          )}
          <button className={`btn ${online ? "btn--primary" : "btn--ghost"}`} onClick={onMenu}>
            {t("app.toMenu")}
          </button>
        </div>
      </div>
    </div>
  );
}
