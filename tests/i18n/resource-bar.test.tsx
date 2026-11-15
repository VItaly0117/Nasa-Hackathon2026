import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ResourceBar } from "../../src/features/game/ResourceBar";
import { setLang, t } from "../../src/i18n";
import type { Resources } from "../../src/types";

const CAPACITY: Resources = {
  oxygen: 100,
  water: 100,
  food: 100,
  energy: 100,
  health: 100,
  materials: 100,
};

const BASE_RESOURCES: Resources = {
  oxygen: 60,
  water: 60,
  food: 60,
  energy: 60,
  health: 60,
  materials: 60,
};

const NO_DELTA: Partial<Resources> = {
  oxygen: 0,
  water: 0,
  food: 0,
  energy: 0,
  health: 0,
  materials: 0,
};

function renderResources(resources: Resources, delta: Partial<Resources> = NO_DELTA): string {
  return renderToStaticMarkup(
    <ResourceBar
      resources={resources}
      delta={delta}
      capacity={CAPACITY}
      otherDelta={delta}
      isNight={false}
    />,
  );
}

describe("resource bar hints and deltas", () => {
  it.each(["ru", "uk", "en"] as const)(
    "shows the capacity hint only for capped non-percent resources (%s)",
    (language) => {
      setLang(language);
      try {
        const percentResourcesAtLimit = renderResources({
          ...BASE_RESOURCES,
          oxygen: CAPACITY.oxygen,
          health: CAPACITY.health,
        });
        const waterAtLimit = renderResources({
          ...BASE_RESOURCES,
          water: CAPACITY.water,
          oxygen: CAPACITY.oxygen,
          health: CAPACITY.health,
        });
        const capHint = t("res.tip.cap");

        expect(percentResourcesAtLimit).not.toContain(capHint);
        expect(waterAtLimit.split(capHint)).toHaveLength(2);
      } finally {
        setLang("uk");
      }
    },
  );

  it.each(["ru", "uk", "en"] as const)(
    "rounds positive and negative deltas to one decimal in %s",
    (language) => {
      setLang(language);
      try {
        const markup = renderResources(
          { ...BASE_RESOURCES, water: 80, food: 80 },
          { ...NO_DELTA, water: 1.26, food: -1.26 },
        );

        expect(markup).toContain(t("res.perDay", { delta: "+1.3" }));
        expect(markup).toContain(t("res.perDay", { delta: "−1.3" }));
      } finally {
        setLang("uk");
      }
    },
  );
});
