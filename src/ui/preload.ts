import moonBg from "@/assets/moon_bg.svg";
import crew1 from "@/assets/crew/crew1.webp";
import crew2 from "@/assets/crew/crew2.webp";
import crew3 from "@/assets/crew/crew3.webp";
import crew4 from "@/assets/crew/crew4.webp";

const IMAGES = [moonBg, crew1, crew2, crew3, crew4];

function loadImage(src: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      // decode() заранее раскодирует картинку, чтобы первый кадр игры не подвис
      (img.decode ? img.decode() : Promise.resolve()).catch(() => undefined).then(() => resolve());
    };
    img.onerror = () => resolve(); // не удалось загрузить — не блокируем игру
    img.src = src;
  });
}

// Грузит всё тяжёлое перед игрой и сообщает прогресс 0..1. Промис завершается, когда готово всё
export function preloadGame(onProgress: (p: number) => void): Promise<void> {
  const tasks: Promise<unknown>[] = [
    ...IMAGES.map(loadImage),
    document.fonts ? document.fonts.ready : Promise.resolve(),
  ];
  let done = 0;
  onProgress(0);
  return Promise.all(
    tasks.map((p) =>
      p.then(() => {
        done += 1;
        onProgress(done / tasks.length);
      }),
    ),
  ).then(() => undefined);
}
