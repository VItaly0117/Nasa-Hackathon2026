import eventsData from "../../data/events.json";
import type { EventDef } from "../../types";
import { t } from "../../i18n";
import { describeFlare } from "../../i18n/messages";
import { sound } from "../../audio/audio";
import { useGame, useSend } from "../../session/react";
import { shallowEqual } from "../../session/store";
import { Avatar } from "../../ui/CrewPanel";
import { CREW } from "../../ui/crewData";

const EVENTS = eventsData as EventDef[];

// Тексты событий лежат в словарях i18n: ev.<id>.title / .text / .<choice>.label / .<choice>.hint
// Цены выборов лежат в events.json (тип EventDef в types.ts)
export function EventModal() {
  const { activeEvent, illness, flare } = useGame((s) => ({ activeEvent: s.activeEvent, illness: s.illness, flare: s.flare }), shallowEqual);
  const send = useSend();
  const event = EVENTS.find((e) => e.id === activeEvent) ?? null;
  if (!event) return null;

  // Кто заболел: портрет и имя, как при просьбе о задании
  const person = event.id === "illness" && illness ? CREW.find((c) => c.id === illness.crewId) : undefined;

  return (
    <div className="overlay">
      <div className="modal" role="dialog" aria-labelledby="event-title">
        {person && (
          <div className="modal__portrait">
            <Avatar skin={person.skin} hair={person.hair} long={person.long} mood={-1} />
          </div>
        )}
        <h2 id="event-title">{t(`ev.${event.id}.title`)}</h2>
        <p>{t(`ev.${event.id}.text`, { name: illness ? t(`crew.n${illness.crewId}`) : "" })}</p>
        {event.id === "flare" && flare && (
          <p className="muted source">
            {t("ev.flare.source", { flare: describeFlare(flare) })}{" "}
            <a href={flare.link} target="_blank" rel="noreferrer">
              {flare.source}
            </a>
          </p>
        )}
        <div className="modal__choices">
          {event.choices.map((choice) => (
            <button
              key={choice.id}
              className="btn btn--choice"
              onClick={() => {
                sound.playDecisionConfirm();
                send({ type: "resolveEvent", choice: choice.id });
              }}
            >
              <strong>{t(`ev.${event.id}.${choice.id}.label`)}</strong>
              <span className="muted">{t(`ev.${event.id}.${choice.id}.hint`)}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
