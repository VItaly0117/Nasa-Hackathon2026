// Имена и роли лежат в словарях i18n: crew.n<id> и crew.r<id>.
// Каждый астронавт ходит к «своим» модулям: так видно, кто чем занят.
// Это пока боты. Позже вместо бота за астронавта сможет играть живой ребёнок команды.
// Номер 3 — врач Виталий (ходит к убежищу и медпункту), id завязаны на словари
export const CREW: { id: number; skin: string; hair: string; long: boolean; suit: string; jobs: string[] }[] = [
  { id: 1, skin: "#f1c7a5", hair: "#2b1d1a", long: true, suit: "#9a6be0", jobs: ["solar", "battery", "lifeSupport"] },
  { id: 2, skin: "#f3c9a8", hair: "#a2522a", long: false, suit: "#d1692d", jobs: ["greenhouse", "lifeSupport"] },
  { id: 3, skin: "#e8b995", hair: "#3a2a22", long: false, suit: "#3552b8", jobs: ["shelter", "medbay"] },
  { id: 4, skin: "#f5d1b3", hair: "#e0b45a", long: false, suit: "#f2b830", jobs: ["habitat"] },
];
