import type { Msg } from "@/types";

// Сообщение для журнала и причин отложенных эффектов. Параметры называются так же, как места в тексте словаря
// ({name}, {days} ...), а значения это id, числа и ключи: перевод делает src/i18n/messages.ts
export function msg(key: string, params?: Record<string, string | number>): Msg {
  return params ? { key, params } : { key };
}
