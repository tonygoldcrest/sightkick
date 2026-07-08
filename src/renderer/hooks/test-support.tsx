import { ReactNode } from 'react';
import { vi } from 'vitest';

export type IpcListener = (...args: unknown[]) => void;

export interface IpcMock {
  sendMessage: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  once: ReturnType<typeof vi.fn>;
  emit: (channel: string, ...args: unknown[]) => void;
  sent: { channel: string; args: unknown[] }[];
  onCount: (channel: string) => number;
  onceCount: (channel: string) => number;
}

export function installIpcMock(): IpcMock {
  const onHandlers = new Map<string, Set<IpcListener>>();
  const onceHandlers = new Map<string, IpcListener[]>();
  const sent: { channel: string; args: unknown[] }[] = [];
  const on = vi.fn((channel: string, func: IpcListener) => {
    let set = onHandlers.get(channel);

    if (!set) {
      set = new Set();
      onHandlers.set(channel, set);
    }

    set.add(func);

    return () => {
      onHandlers.get(channel)?.delete(func);
    };
  });
  const once = vi.fn((channel: string, func: IpcListener) => {
    const arr = onceHandlers.get(channel) ?? [];

    arr.push(func);
    onceHandlers.set(channel, arr);

    return () => {
      const current = onceHandlers.get(channel);

      if (current) {
        onceHandlers.set(
          channel,
          current.filter((h) => h !== func),
        );
      }
    };
  });
  const sendMessage = vi.fn((channel: string, ...args: unknown[]) => {
    sent.push({ channel, args });
  });
  const emit = (channel: string, ...args: unknown[]) => {
    onHandlers.get(channel)?.forEach((h) => h(...args));

    const arr = onceHandlers.get(channel);

    if (arr && arr.length) {
      onceHandlers.set(channel, []);
      arr.forEach((h) => h(...args));
    }
  };

  (window as unknown as { electron: unknown }).electron = {
    ipcRenderer: { sendMessage, on, once },
  };

  return {
    sendMessage,
    on,
    once,
    emit,
    sent,
    onCount: (channel: string) => onHandlers.get(channel)?.size ?? 0,
    onceCount: (channel: string) => onceHandlers.get(channel)?.length ?? 0,
  };
}

export function installLocalStorage() {
  const store = new Map<string, string>();

  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
      setItem: (key: string, value: string) => {
        store.set(key, String(value));
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
      clear: () => store.clear(),
      key: (index: number) => [...store.keys()][index] ?? null,
      get length() {
        return store.size;
      },
    },
  });
}

export interface NotificationMock {
  error: ReturnType<typeof vi.fn>;
  success: ReturnType<typeof vi.fn>;
  info: ReturnType<typeof vi.fn>;
  warning: ReturnType<typeof vi.fn>;
  open: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
}

export function resetNotification(): NotificationMock {
  const notification: NotificationMock = {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    open: vi.fn(),
    destroy: vi.fn(),
  };

  (
    globalThis as unknown as { __notification__: NotificationMock }
  ).__notification__ = notification;

  return notification;
}

export function getNotification(): NotificationMock {
  return (globalThis as unknown as { __notification__: NotificationMock })
    .__notification__;
}

export function PassThrough({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
