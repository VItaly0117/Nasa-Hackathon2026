import eventsData from "@/content/events.json";
import type { EventDef } from "@/types";
import { t, tDynamic } from "@/i18n";
import { describeFlare, describeRadiation } from "@/i18n/messages";
import { sound } from "@/audio/audio";
import { useGame, useSend } from "@/session/hooks";
import { shallowEqual } from "@/session/store";
import { useGameUi } from "./ui-state";
import { Avatar } from "./CrewPanel";
import { CREW } from "@/ui/crewData";

const EVENTS = eventsData as EventDef[];

// Тексты событий лежат в словарях i18n: ev.<id>.title / .text / .<choice>.label / .<choice>.hint
// Цены выборов лежат в events.json (тип EventDef в types.ts)
export function EventModal() {
  const { activeEvent, illness, flare } = useGame((s) => ({ activeEvent: s.activeEvent, illness: s.illness, flare: s.flare }), shallowEqual);
  const send = useSend();
  const ui = useGameUi();
  // Пока открыты итоги дня, событие ждёт: сначала итоги, потом новое решение
  const event = ui.summary ? null : (EVENTS.find((e) => e.id === activeEvent) ?? null);
  if (!event) return null;

  // Кто заболел: портрет и имя, как при просьбе о задании
  const person = event.id === "illness" && illness ? CREW.find((c) => c.id === illness.crewId) : undefined;

  return (
    <div className="overlay">
      <div className="modal modal--event" role="dialog" aria-labelledby="event-title">
        {event.id !== "illness" && <div className="modal__badge" aria-hidden="true">⚠️</div>}
        {person && (
          <div className="modal__portrait">
            <Avatar skin={person.skin} hair={person.hair} long={person.long} mood={-1} />
          </div>
        )}
        <h2 id="event-title">{tDynamic(`ev.${event.id}.title`)}</h2>
        <p>{tDynamic(`ev.${event.id}.text`, { name: illness ? tDynamic(`crew.n${illness.crewId}`) : "" })}</p>
        {event.id === "flare" && flare && (
          <p className="muted source">
            {t("ev.flare.source", { flare: describeFlare(flare) })}{" "}
            <a href={flare.link} target="_blank" rel="noreferrer">
              {flare.source}
            </a>
          </p>
        )}
        {event.id === "flare" && flare && <p className="muted source">{describeRadiation(flare)}</p>}
        <div className="modal__choices">
          {event.choices.map((choice, i) => (
            <button
              key={choice.id}
              className={`btn btn--choice${i === 0 ? " btn--choice-main" : ""}`}
              onClick={() => {
                sound.playDecisionConfirm();
                send({ type: "resolveEvent", choice: choice.id });
              }}
            >
              <strong>{tDynamic(`ev.${event.id}.${choice.id}.label`)}</strong>
              <span className="muted">{tDynamic(`ev.${event.id}.${choice.id}.hint`)}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
