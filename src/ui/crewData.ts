// Имена и роли лежат в словарях i18n: crew.n<id> и crew.r<id>.
// Каждый астронавт ходит к «своим» модулям: так видно, кто чем занят.
// Это пока боты. Позже вместо бота за астронавта сможет играть живой ребёнок команды.
// Номера 3 (София) нет: её убрали из экипажа, id остальных не меняем, на них завязаны словари
export const CREW: { id: number; skin: string; hair: string; long: boolean; suit: string; jobs: string[] }[] = [
  { id: 1, skin: "#f1c7a5", hair: "#2b1d1a", long: true, suit: "#ffb347", jobs: ["solar", "battery", "lifeSupport"] },
  { id: 2, skin: "#f3c9a8", hair: "#a2522a", long: false, suit: "#7fe0b0", jobs: ["greenhouse", "lifeSupport"] },
  { id: 4, skin: "#f5d1b3", hair: "#e0b45a", long: false, suit: "#8fb4ff", jobs: ["habitat", "shelter", "medbay"] },
];
