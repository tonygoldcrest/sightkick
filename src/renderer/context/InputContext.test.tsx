import { ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getNotification,
  installIpcMock,
  installLocalStorage,
  IpcMock,
  NotificationMock,
  resetNotification,
} from '../hooks/test-support';
import { InputDevice } from '../input';
import { InputProvider, useInput } from './InputContext';

vi.mock('antd', async (importOriginal) => {
  const actual = await importOriginal<typeof import('antd')>();

  return {
    ...actual,
    App: Object.assign({}, actual.App, {
      useApp: () => ({ notification: getNotification() }),
    }),
  };
});

let ipc: IpcMock;
let notification: NotificationMock;

function wrapper({ children }: { children: ReactNode }) {
  return <InputProvider>{children}</InputProvider>;
}

function listenPorts() {
  return ipc.sent
    .filter((s) => s.channel === 'listen-midi')
    .map((s) => s.args[0]);
}

function stopCount() {
  return ipc.sent.filter((s) => s.channel === 'stop-listen-midi').length;
}

beforeEach(() => {
  installLocalStorage();
  ipc = installIpcMock();
  notification = resetNotification();
});

const DEVICE_A: InputDevice = {
  id: 'midi:Pad A',
  name: 'Pad A',
  sourceId: 'midi',
  port: 2,
};
const DEVICE_B: InputDevice = {
  id: 'midi:Pad B',
  name: 'Pad B',
  sourceId: 'midi',
  port: 5,
};

describe('InputContext midi stream ownership', () => {
  it('does not listen when no device is selected', () => {
    renderHook(() => useInput(), { wrapper });

    expect(listenPorts()).toEqual([]);
  });

  it('starts listening when a device is selected', () => {
    const { result } = renderHook(() => useInput(), { wrapper });

    act(() => result.current.setSelectedDevice(DEVICE_A));

    expect(listenPorts()).toEqual([2]);
  });

  it('restarts on the new port when the device changes', () => {
    const { result } = renderHook(() => useInput(), { wrapper });

    act(() => result.current.setSelectedDevice(DEVICE_A));
    act(() => result.current.setSelectedDevice(DEVICE_B));

    expect(listenPorts()).toEqual([2, 5]);
    expect(stopCount()).toBe(1);
  });

  it('stops listening when the device is cleared', () => {
    const { result } = renderHook(() => useInput(), { wrapper });

    act(() => result.current.setSelectedDevice(DEVICE_A));
    act(() => result.current.setSelectedDevice(null));

    expect(stopCount()).toBe(1);
  });

  it('stops listening on unmount', () => {
    const { result, unmount } = renderHook(() => useInput(), { wrapper });

    act(() => result.current.setSelectedDevice(DEVICE_A));
    unmount();

    expect(stopCount()).toBe(1);
  });

  it('notifies when the selected device fails to connect', () => {
    const { result } = renderHook(() => useInput(), { wrapper });

    act(() => result.current.setSelectedDevice(DEVICE_A));
    act(() => ipc.emit('midi-error', { error: 'device unavailable' }));

    expect(notification.error).toHaveBeenCalledTimes(1);
    expect(notification.error.mock.calls[0][0]).toMatchObject({
      title: "Couldn't connect to your MIDI device",
    });
  });

  it('stops listening for connect errors once the device is cleared', () => {
    const { result } = renderHook(() => useInput(), { wrapper });

    act(() => result.current.setSelectedDevice(DEVICE_A));

    expect(ipc.onCount('midi-error')).toBe(1);

    act(() => result.current.setSelectedDevice(null));

    expect(ipc.onCount('midi-error')).toBe(0);
  });
});

describe('InputContext input mapping', () => {
  it('ignores control assignment when no device is selected', () => {
    const { result } = renderHook(() => useInput(), { wrapper });

    act(() => result.current.assignControl('snare', 'midi:38'));

    expect(result.current.inputMapping.snare).toEqual([]);
  });

  it('assigns a control to the selected device element', () => {
    const { result } = renderHook(() => useInput(), { wrapper });

    act(() => result.current.setSelectedDevice(DEVICE_A));
    act(() => result.current.assignControl('snare', 'midi:38'));

    expect(result.current.inputMapping.snare).toEqual(['midi:38']);
  });

  it('does not duplicate a control already bound to the element', () => {
    const { result } = renderHook(() => useInput(), { wrapper });

    act(() => result.current.setSelectedDevice(DEVICE_A));
    act(() => result.current.assignControl('snare', 'midi:38'));
    act(() => result.current.assignControl('snare', 'midi:38'));

    expect(result.current.inputMapping.snare).toEqual(['midi:38']);
  });

  it('moves a control off other elements when reassigned', () => {
    const { result } = renderHook(() => useInput(), { wrapper });

    act(() => result.current.setSelectedDevice(DEVICE_A));
    act(() => result.current.assignControl('snare', 'midi:38'));
    act(() => result.current.assignControl('kick', 'midi:38'));

    expect(result.current.inputMapping.snare).toEqual([]);
    expect(result.current.inputMapping.kick).toEqual(['midi:38']);
  });

  it('removes a bound control from an element', () => {
    const { result } = renderHook(() => useInput(), { wrapper });

    act(() => result.current.setSelectedDevice(DEVICE_A));
    act(() => result.current.assignControl('snare', 'midi:38'));
    act(() => result.current.removeControl('snare', 'midi:38'));

    expect(result.current.inputMapping.snare).toEqual([]);
  });

  it('keeps mappings separate per device', () => {
    const { result } = renderHook(() => useInput(), { wrapper });

    act(() => result.current.setSelectedDevice(DEVICE_A));
    act(() => result.current.assignControl('snare', 'midi:38'));
    act(() => result.current.setSelectedDevice(DEVICE_B));

    expect(result.current.inputMapping.snare).toEqual([]);
  });
});

describe('InputContext control mapping', () => {
  it('assigns a control to an app-control element', () => {
    const { result } = renderHook(() => useInput(), { wrapper });

    act(() => result.current.setSelectedDevice(DEVICE_A));
    act(() => result.current.assignControl('up', 'midi:50'));

    expect(result.current.controlMapping.up).toEqual(['midi:50']);
    expect(result.current.inputMapping).not.toHaveProperty('up');
  });

  it('checks uniqueness per category, so a control can map a kit element and an app control at once', () => {
    const { result } = renderHook(() => useInput(), { wrapper });

    act(() => result.current.setSelectedDevice(DEVICE_A));
    act(() => result.current.assignControl('snare', 'midi:38'));
    act(() => result.current.assignControl('confirm', 'midi:38'));

    expect(result.current.inputMapping.snare).toEqual(['midi:38']);
    expect(result.current.controlMapping.confirm).toEqual(['midi:38']);
  });

  it('moves a control off other app controls when reassigned, leaving the kit alone', () => {
    const { result } = renderHook(() => useInput(), { wrapper });

    act(() => result.current.setSelectedDevice(DEVICE_A));
    act(() => result.current.assignControl('snare', 'midi:38'));
    act(() => result.current.assignControl('up', 'midi:38'));
    act(() => result.current.assignControl('down', 'midi:38'));

    expect(result.current.controlMapping.up).toEqual([]);
    expect(result.current.controlMapping.down).toEqual(['midi:38']);
    expect(result.current.inputMapping.snare).toEqual(['midi:38']);
  });

  it('removes a bound control from an app-control element', () => {
    const { result } = renderHook(() => useInput(), { wrapper });

    act(() => result.current.setSelectedDevice(DEVICE_A));
    act(() => result.current.assignControl('pause', 'midi:39'));
    act(() => result.current.removeControl('pause', 'midi:39'));

    expect(result.current.controlMapping.pause).toEqual([]);
  });
});

describe('InputContext control category uniqueness', () => {
  it('lets one control bind a library element and a game element at once', () => {
    const { result } = renderHook(() => useInput(), { wrapper });

    act(() => result.current.setSelectedDevice(DEVICE_A));
    act(() => result.current.assignControl('sort', 'midi:40'));
    act(() => result.current.assignControl('pause', 'midi:40'));

    expect(result.current.controlMapping.sort).toEqual(['midi:40']);
    expect(result.current.controlMapping.pause).toEqual(['midi:40']);
  });

  it('moves a control within the library group but leaves a game binding alone', () => {
    const { result } = renderHook(() => useInput(), { wrapper });

    act(() => result.current.setSelectedDevice(DEVICE_A));
    act(() => result.current.assignControl('pause', 'midi:41'));
    act(() => result.current.assignControl('sort', 'midi:41'));
    act(() => result.current.assignControl('difficulty', 'midi:41'));

    expect(result.current.controlMapping.sort).toEqual([]);
    expect(result.current.controlMapping.difficulty).toEqual(['midi:41']);
    expect(result.current.controlMapping.pause).toEqual(['midi:41']);
  });

  it('moves a control within the game group but leaves a library binding alone', () => {
    const { result } = renderHook(() => useInput(), { wrapper });

    act(() => result.current.setSelectedDevice(DEVICE_A));
    act(() => result.current.assignControl('sort', 'midi:42'));
    act(() => result.current.assignControl('pause', 'midi:42'));
    act(() => result.current.assignControl('left', 'midi:42'));

    expect(result.current.controlMapping.pause).toEqual([]);
    expect(result.current.controlMapping.left).toEqual(['midi:42']);
    expect(result.current.controlMapping.sort).toEqual(['midi:42']);
  });

  it('clears a shared control off both the library and game groups', () => {
    const { result } = renderHook(() => useInput(), { wrapper });

    act(() => result.current.setSelectedDevice(DEVICE_A));
    act(() => result.current.assignControl('sort', 'midi:43'));
    act(() => result.current.assignControl('pause', 'midi:43'));
    act(() => result.current.assignControl('confirm', 'midi:43'));

    expect(result.current.controlMapping.sort).toEqual([]);
    expect(result.current.controlMapping.pause).toEqual([]);
    expect(result.current.controlMapping.confirm).toEqual(['midi:43']);
  });

  it('clears a shared binding when the control is reassigned to a game element', () => {
    const { result } = renderHook(() => useInput(), { wrapper });

    act(() => result.current.setSelectedDevice(DEVICE_A));
    act(() => result.current.assignControl('confirm', 'midi:44'));
    act(() => result.current.assignControl('pause', 'midi:44'));

    expect(result.current.controlMapping.confirm).toEqual([]);
    expect(result.current.controlMapping.pause).toEqual(['midi:44']);
  });
});

const KEYBOARD: InputDevice = {
  id: 'keyboard',
  name: 'Keyboard',
  sourceId: 'keyboard',
};

describe('InputContext keyboard default suppression', () => {
  function dispatchKey(code: string, target?: EventTarget) {
    const event = new KeyboardEvent('keydown', {
      code,
      bubbles: true,
      cancelable: true,
    });

    act(() => {
      if (target) {
        target.dispatchEvent(event);
      } else {
        window.dispatchEvent(event);
      }
    });

    return event;
  }

  function bindSpaceOnKeyboard() {
    const { result } = renderHook(() => useInput(), { wrapper });

    act(() => result.current.setSelectedDevice(KEYBOARD));
    act(() => result.current.assignControl('kick', 'keyboard:Space'));

    return result;
  }

  it('suppresses the default action for a bound key', () => {
    bindSpaceOnKeyboard();

    expect(dispatchKey('Space').defaultPrevented).toBe(true);
  });

  it('leaves unbound keys alone', () => {
    bindSpaceOnKeyboard();

    expect(dispatchKey('KeyZ').defaultPrevented).toBe(false);
  });

  it('does not suppress while typing in an input', () => {
    bindSpaceOnKeyboard();

    const input = document.createElement('input');

    document.body.append(input);

    expect(dispatchKey('Space', input).defaultPrevented).toBe(false);

    input.remove();
  });

  it('does not suppress when a non-keyboard device is selected', () => {
    const { result } = renderHook(() => useInput(), { wrapper });

    act(() => result.current.setSelectedDevice(DEVICE_A));

    expect(dispatchKey('Space').defaultPrevented).toBe(false);
  });
});

describe('useInput', () => {
  it('throws when used outside the provider', () => {
    expect(() => renderHook(() => useInput())).toThrow(
      'useInput must be used within InputProvider',
    );
  });
});
