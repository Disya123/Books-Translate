// Polyfill для Event и EventTarget для React Native
// Необходим для работы eventsource пакета в RN среде

// Polyfill для atob если недоступен (для декодирования base64)
if (typeof atob === 'undefined') {
  global.atob = function (base64: string): string {
    // Простая реализация декодирования base64
    const chars =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    let result = '';
    let i = 0;
    while (i < base64.length) {
      const enc1 = chars.indexOf(base64.charAt(i++));
      const enc2 = chars.indexOf(base64.charAt(i++));
      const enc3 = chars.indexOf(base64.charAt(i++));
      const enc4 = chars.indexOf(base64.charAt(i++));

      const chr1 = (enc1 << 2) | (enc2 >> 4);
      const chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
      const chr3 = ((enc3 & 3) << 6) | enc4;

      result += String.fromCharCode(chr1);

      if (enc3 !== 64) {
        result += String.fromCharCode(chr2);
      }
      if (enc4 !== 64) {
        result += String.fromCharCode(chr3);
      }
    }
    return result;
  };
}

// Utility функция для декодирования base64, работающая и в Node.js (Buffer) и в React Native (atob)
export function decodeBase64(base64: string): string {
  // В React Native/Expo с metro bundler Buffer может быть доступен
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(base64, 'base64').toString('utf8');
  }

  // Fallback для чистого JS (работает в RN)
  const binaryString = global.atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

if (typeof Event === 'undefined') {
  global.Event = class Event {
    type: string;
    target?: unknown;
    bubbles?: boolean;
    cancelable?: boolean;
    defaultPrevented?: boolean;
    timeStamp?: number;

    constructor(type: string, eventInitDict?: EventInit) {
      this.type = type;
      if (eventInitDict) {
        this.bubbles = eventInitDict.bubbles ?? false;
        this.cancelable = eventInitDict.cancelable ?? false;
        this.defaultPrevented = false;
        this.timeStamp = Date.now();
      }
    }

    preventDefault(): void {
      this.defaultPrevented = true;
    }

    stopPropagation(): void {
      // В React Native останавливать распространение не нужно
    }
  } as any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

if (typeof EventTarget === 'undefined') {
  global.EventTarget = class EventTarget {
    listeners: Map<string, Set<EventListener>>;

    constructor() {
      this.listeners = new Map();
    }

    addEventListener(
      type: string,
      callback: EventListener,
      _options?: AddEventListenerOptions
    ): void {
      if (!this.listeners.has(type)) {
        this.listeners.set(type, new Set());
      }
      this.listeners.get(type)?.add(callback);
    }

    removeEventListener(
      type: string,
      callback: EventListener,
      _options?: EventListenerOptions
    ): void {
      const set = this.listeners.get(type);
      if (set) {
        set.delete(callback);
        if (set.size === 0) {
          this.listeners.delete(type);
        }
      }
    }

    dispatchEvent(event: Event): boolean {
      const set = this.listeners.get(event.type);
      if (set) {
        set.forEach((callback) => callback(event));
        return true;
      }
      return false;
    }
  } as any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

// Type definitions
interface EventInit {
  bubbles?: boolean;
  cancelable?: boolean;
}

interface AddEventListenerOptions {
  capture?: boolean;
  once?: boolean;
  passive?: boolean;
}

interface EventListenerOptions {
  capture?: boolean;
}

type EventListener = (event: Event) => void;
