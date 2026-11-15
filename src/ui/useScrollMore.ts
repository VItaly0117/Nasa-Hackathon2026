import { useEffect, useRef } from "react";

// Ставит data-more="true", пока внизу контейнера есть непоказанное содержимое (для подсказки «прокрути вниз»)
export function useScrollMore<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      el.dataset.more = String(el.scrollHeight - el.scrollTop - el.clientHeight > 6);
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    const mo = new MutationObserver(update);
    mo.observe(el, { childList: true, subtree: true });
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
      mo.disconnect();
    };
  }, []);
  return ref;
}
