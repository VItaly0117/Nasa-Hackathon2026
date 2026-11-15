import eventsData from "@/content/events.json";
import type { EventDef } from "@/types";
import { tDynamic } from "@/i18n";
import { sound } from "@/audio/audio";
import { useGame, useSend } from "@/session/hooks";
import { shallowEqual } from "@/session/store";
import { useGameUi } from "./ui-state";
import { Avatar } from "./CrewPanel";
import { CREW } from "@/ui/crewData";
import { FlareBadgeIcon, BreakdownBadgeIcon, AlertBadgeIcon } from "@/ui/icons";

const EVENTS = eventsData as EventDef[];

// Тексты событий лежат в словарях i18n: ev.<id>.title / .text / .<choice>.label / .<choice>.hint
// Цены выборов лежат в events.json (тип EventDef в types.ts)
export function EventModal() {
  const { activeEvent, illness } = useGame((s) => ({ activeEvent: s.activeEvent, illness: s.illness }), shallowEqual);
  const send = useSend();
  const ui = useGameUi();
  // Пока открыты итоги дня, событие ждёт: сначала итоги, потом новое решение
  const event = ui.summary ? null : (EVENTS.find((e) => e.id === activeEvent) ?? null);
  if (!event) return null;

  // Кто заболел: портрет и имя, как при просьбе о задании
  const person = event.id === "illness" && illness ? CREW.find((c) => c.id === illness.crewId) : undefined;

  const renderBadge = () => {
    if (event.id === "illness" && person) {
      return (
        <div className="modal__portrait">
          <Avatar skin={person.skin} hair={person.hair} long={person.long} mood={-1} />
        </div>
      );
    }
    if (event.id === "flare") {
      return (
        <div className="modal__badge modal__badge--flare" aria-hidden="true">
          <FlareBadgeIcon size={44} />
        </div>
      );
    }
    if (event.id === "breakdown") {
      return (
        <div className="modal__badge modal__badge--breakdown" aria-hidden="true">
          <BreakdownBadgeIcon size={44} />
        </div>
      );
    }
    return (
      <div className="modal__badge" aria-hidden="true">
        <AlertBadgeIcon size={44} />
      </div>
    );
  };

  return (
    <div className="overlay">
      <div className="modal modal--event" role="dialog" aria-labelledby="event-title">
        {renderBadge()}
        <h2 id="event-title">{tDynamic(`ev.${event.id}.title`)}</h2>
        <p className="modal--event__description">
          {tDynamic(`ev.${event.id}.text`, { name: illness ? tDynamic(`crew.n${illness.crewId}`) : "" })}
        </p>
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
              <strong className="btn--choice-title">{tDynamic(`ev.${event.id}.${choice.id}.label`)}</strong>
              <span className="btn--choice-hint">{tDynamic(`ev.${event.id}.${choice.id}.hint`)}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
