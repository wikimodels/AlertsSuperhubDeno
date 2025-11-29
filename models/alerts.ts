// --- Общие поля всех алертов ---
export interface AlertBase {
  symbol: string;
  alertName: string;
  action: string;
  price: number;
  description?: string;
  tvScreensUrls?: string[];
  exchanges: string[];
  category?: number;

  // Общие для всех алертов поля состояния
  _id?: string; // MongoDB _id (опционально, только при сохранении)
  id: string; // UUID (обязательно)
  creationTime?: number;
  activationTime?: number;
  activationTimeStr?: string;
  highPrice?: number;
  lowPrice?: number;
  isActive: boolean;

  // Дополнительные ссылки
  tvLink?: string;
  cgLink?: string;
}

// --- Line Alert: наследует всё от AlertBase ---
export interface LineAlert extends AlertBase {
  imagesUrls?: string[];
}

// --- VWAP Alert: расширяет AlertBase специфичными полями ---
export interface VwapAlert extends AlertBase {
  // VWAP-специфичные поля
  anchorTime?: number; // timestamp в миллисекундах
  anchorTimeStr?: string;
  anchorPrice?: number; // рассчитанный VWAP на момент активации
  imageUrl?: string;

  // Переопределяем price как опциональное, т.к. оно устанавливается при триггере
  price: number; // цена срабатывания = anchorPrice
}

// --- Тип коллекции ---
export type AlertsCollection = "working" | "triggered" | "archived";
