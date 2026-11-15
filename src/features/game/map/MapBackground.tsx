import { memo, useEffect, useRef } from "react";
import moonBg from "@/assets/moon_bg.svg";

// Фон — тяжёлый SVG (тысячи контуров, ~2 МБ). Если отдать его браузеру как есть, он перерисовывает
// эти контуры при каждой смене масштаба — отсюда лаги. Поэтому один раз превращаем его в растр
// на canvas: дальше фон — обычная GPU-текстура, и двигать/масштабировать её почти бесплатно.
const RASTER_WIDTH = 3200;

type Props = {
  imageWidth: number; // размер картинки в единицах карты
  imageHeight: number;
  width: number; // видимая часть (нижний край картинки обрезан)
  height: number;
};

function MapBackgroundImpl({ imageWidth, imageHeight, width, height }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let cancelled = false;
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      if (cancelled) return;
      const ratio = RASTER_WIDTH / imageWidth;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, imageWidth * ratio, imageHeight * ratio);
      canvas.style.opacity = "1";
    };
    img.src = moonBg;
    return () => {
      cancelled = true;
      img.onload = null;
    };
  }, [imageWidth, imageHeight, width, height]);

  return <canvas ref={ref} className="map-bg" style={{ width, height, opacity: 0 }} aria-hidden="true" />;
}

export const MapBackground = memo(MapBackgroundImpl);
