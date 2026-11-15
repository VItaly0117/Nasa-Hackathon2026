// Имена и роли лежат в словарях i18n: crew.n<id> и crew.r<id>.
// Каждый астронавт ходит к «своим» модулям: так видно, кто чем занят.
// Это пока боты. Позже вместо бота за астронавта сможет играть живой ребёнок команды.
// Номер 3 — врач Виталий (ходит к убежищу и медпункту), id завязаны на словари
export const CREW: { id: number; skin: string; hair: string; long: boolean; suit: string; jobs: string[] }[] = [
  { id: 1, skin: "#f1c7a5", hair: "#2b1d1a", long: true, suit: "#ffb347", jobs: ["solar", "battery", "lifeSupport"] },
  { id: 2, skin: "#f3c9a8", hair: "#a2522a", long: false, suit: "#7fe0b0", jobs: ["greenhouse", "lifeSupport"] },
  { id: 3, skin: "#e8b995", hair: "#3a2a22", long: false, suit: "#ff7b8a", jobs: ["shelter", "medbay"] },
  { id: 4, skin: "#f5d1b3", hair: "#e0b45a", long: false, suit: "#8fb4ff", jobs: ["habitat"] },
];
