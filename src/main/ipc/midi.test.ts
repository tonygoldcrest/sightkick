import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeEvent, lastReply } from './test-support';

interface FakeInput {
  openPort: ReturnType<typeof vi.fn>;
  closePort: ReturnType<typeof vi.fn>;
  getPortCount: ReturnType<typeof vi.fn>;
  getPortName: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  removeAllListeners: ReturnType<typeof vi.fn>;
  emit: (event: string, ...args: unknown[]) => void;
}

const holder = vi.hoisted(() => ({
  instances: [] as FakeInput[],
  ports: ['TD-07', 'Other Kit'],
  openError: undefined as string | undefined,
}));

vi.mock('@julusian/midi', () => {
  class Input implements FakeInput {
    private listeners = new Map<string, (...args: unknown[]) => void>();

    getPortCount = vi.fn(() => holder.ports.length);

    getPortName = vi.fn((index: number) => holder.ports[index]);

    on = vi.fn((event: string, cb: (...args: unknown[]) => void) => {
      this.listeners.set(event, cb);
    });

    removeAllListeners = vi.fn((event: string) => {
      this.listeners.delete(event);
    });

    openPort = vi.fn(() => {
      if (holder.openError) {
        throw new Error(holder.openError);
      }
    });

    closePort = vi.fn();

    emit(event: string, ...args: unknown[]) {
      this.listeners.get(event)?.(...args);
    }

    constructor() {
      holder.instances.push(this);
    }
  }

  return { default: { Input } };
});

const { loadMidiDeviceList, listenMidi, stopListenMidi } = await import(
  './midi'
);

beforeEach(() => {
  stopListenMidi();
  holder.instances = [];
  holder.ports = ['TD-07', 'Other Kit'];
  holder.openError = undefined;
});

describe('loadMidiDeviceList', () => {
  it('replies with the enumerated ports', () => {
    const event = makeEvent();

    loadMidiDeviceList(event as never);

    expect(lastReply(event, 'midi-device-list').args[0]).toEqual([
      { port: 0, name: 'TD-07' },
      { port: 1, name: 'Other Kit' },
    ]);
  });

  it('closes the input used for enumeration', () => {
    const event = makeEvent();

    loadMidiDeviceList(event as never);

    expect(holder.instances).toHaveLength(1);
    expect(holder.instances[0].closePort).toHaveBeenCalledTimes(1);
  });
});

describe('listenMidi', () => {
  it('opens the requested port', () => {
    const event = makeEvent();

    listenMidi(event as never, 1);

    expect(holder.instances[0].openPort).toHaveBeenCalledWith(1);
  });

  it('forwards note-on messages to the renderer', () => {
    const event = makeEvent();

    listenMidi(event as never, 0);
    holder.instances[0].emit('message', 0, [0x99, 38, 100]);

    expect(lastReply(event, 'listen-midi').args[0]).toEqual({
      type: 0x90,
      note: 38,
      velocity: 100,
      channel: 9,
    });
  });

  it('closes the previous port before opening a new one', () => {
    const event = makeEvent();

    listenMidi(event as never, 0);
    listenMidi(event as never, 1);

    expect(holder.instances[0].closePort).toHaveBeenCalledTimes(1);
    expect(holder.instances[1].openPort).toHaveBeenCalledWith(1);
  });

  it('replies with midi-error and releases the port when opening fails', () => {
    holder.openError = 'device unavailable';

    const event = makeEvent();

    listenMidi(event as never, 0);

    expect(lastReply(event, 'midi-error').args[0]).toEqual({
      error: 'device unavailable',
    });
    expect(holder.instances[0].closePort).toHaveBeenCalledTimes(1);
    expect(holder.instances[0].removeAllListeners).toHaveBeenCalledWith(
      'message',
    );
  });

  it('does not leave a failed port active', () => {
    holder.openError = 'device unavailable';

    const event = makeEvent();

    listenMidi(event as never, 0);
    stopListenMidi();

    expect(holder.instances[0].closePort).toHaveBeenCalledTimes(1);
  });
});

describe('stopListenMidi', () => {
  it('closes the active port so it is released', () => {
    const event = makeEvent();

    listenMidi(event as never, 0);
    stopListenMidi();

    expect(holder.instances[0].closePort).toHaveBeenCalledTimes(1);
  });

  it('is a no-op when nothing is listening', () => {
    expect(() => stopListenMidi()).not.toThrow();
  });
});
