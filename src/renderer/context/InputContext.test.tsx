import { ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  installIpcMock,
  installLocalStorage,
  IpcMock,
} from '../hooks/test-support';
import { InputDevice } from '../input';
import { InputProvider, useInput } from './InputContext';

let ipc: IpcMock;

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
