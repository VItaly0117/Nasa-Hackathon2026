import { memo, useEffect, useRef } from "react";
import moonBg from "@/assets/moon_bg.svg";

// Фон — тяжёлый SVG (тысячи контуров, ~2 МБ). Если отдать его браузеру как есть, он перерисовывает
// эти контуры при каждой смене масштаба — отсюда лаги. Поэтому один раз превращаем его в растр
// на canvas: дальше фон — обычная GPU-текстура, и двигать/масштабировать её почти бесплатно.
//
// Почему фон мог «пропадать» (и что сделано):
// 1) при каждом новом показе карты (новая игра, «Продолжить») картинка грузилась и растрировалась заново, и несколько
//    сотен миллисекунд вместо фона был тёмный экран → растр теперь делается один раз на всю страницу и кладётся в кэш;
// 2) браузер имеет право сбросить содержимое большого canvas (нехватка видеопамяти, вкладка ушла в фон) → теперь рисуем заново
//    из кэша при возврате на вкладку и по событиям потери и возврата контекста;
// 3) если SVG не загрузился, раньше фон оставался прозрачным навсегда → теперь рисуется запасной градиент.
const RASTER_WIDTH = 3200;

type Props = {
  imageWidth: number; // размер картинки в единицах карты
  imageHeight: number;
  width: number; // видимая часть (нижний край картинки обрезан)
  height: number;
};

// Растр фона, общий для всех показов карты на странице
let rasterCache: { key: string; canvas: HTMLCanvasElement } | null = null;
let rasterPending: { key: string; promise: Promise<HTMLCanvasElement | null> } | null = null;

function rasterize(key: string, imageWidth: number, imageHeight: number, width: number, height: number): Promise<HTMLCanvasElement | null> {
  if (rasterCache?.key === key) return Promise.resolve(rasterCache.canvas);
  if (rasterPending?.key === key) return rasterPending.promise;
  const promise = new Promise<HTMLCanvasElement | null>((resolve) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      const ratio = RASTER_WIDTH / imageWidth;
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve(null);
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, imageWidth * ratio, imageHeight * ratio);
      rasterCache = { key, canvas };
      resolve(canvas);
    };
    img.onerror = () => resolve(null);
    img.src = moonBg;
  });
  rasterPending = { key, promise };
  return promise;
}

// Запасной фон, если картинка не загрузилась: небо и поверхность одним градиентом
function drawFallback(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
  g.addColorStop(0, "#0b1026");
  g.addColorStop(0.3, "#2a2f66");
  g.addColorStop(0.32, "#8a7fa3");
  g.addColorStop(1, "#6c6482");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function MapBackgroundImpl({ imageWidth, imageHeight, width, height }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let cancelled = false;
    const key = `${imageWidth}x${imageHeight}@${width}x${height}`;

    const paint = () => {
      void rasterize(key, imageWidth, imageHeight, width, height).then((source) => {
        if (cancelled) return;
        if (source) {
          canvas.width = source.width;
          canvas.height = source.height;
          canvas.getContext("2d")?.drawImage(source, 0, 0);
        } else {
          canvas.width = Math.round(width);
          canvas.height = Math.round(height);
          drawFallback(canvas);
        }
        canvas.style.opacity = "1";
      });
    };

    // Если растр уже есть в кэше, рисуем сразу, без ожидания (фон не мигает при новом показе карты)
    if (rasterCache?.key === key) {
      canvas.width = rasterCache.canvas.width;
      canvas.height = rasterCache.canvas.height;
      canvas.getContext("2d")?.drawImage(rasterCache.canvas, 0, 0);
      canvas.style.transition = "none"; // без плавного появления: фон нужен сразу
      canvas.style.opacity = "1";
    } else {
      paint();
    }

    // Браузер мог сбросить содержимое canvas, пока вкладка была в фоне или не хватало памяти: рисуем заново из кэша
    const onVisible = () => {
      if (document.visibilityState === "visible") paint();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", paint);
    canvas.addEventListener("contextrestored", paint);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", paint);
      canvas.removeEventListener("contextrestored", paint);
    };
  }, [imageWidth, imageHeight, width, height]);

  return <canvas ref={ref} className="map-bg" style={{ width, height, opacity: 0 }} aria-hidden="true" />;
}

export const MapBackground = memo(MapBackgroundImpl);
