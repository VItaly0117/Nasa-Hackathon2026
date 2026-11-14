// Имена и роли лежат в словарях i18n: crew.n1..n4 и crew.r1..r4.
// Каждый астронавт ходит к «своим» модулям: так видно, кто чем занят.
// Это пока боты. Позже вместо бота за астронавта сможет играть живой ребёнок команды.
export const CREW: { id: number; skin: string; hair: string; long: boolean; suit: string; jobs: string[] }[] = [
  { id: 1, skin: "#f1c7a5", hair: "#2b1d1a", long: true, suit: "#ffb347", jobs: ["solar", "battery", "lifeSupport"] },
  { id: 2, skin: "#f3c9a8", hair: "#a2522a", long: false, suit: "#7fe0b0", jobs: ["greenhouse", "lifeSupport"] },
  { id: 3, skin: "#e9b996", hair: "#3a2a24", long: true, suit: "#ff8fa3", jobs: ["habitat", "shelter"] },
  { id: 4, skin: "#f5d1b3", hair: "#e0b45a", long: false, suit: "#8fb4ff", jobs: [] },
];
