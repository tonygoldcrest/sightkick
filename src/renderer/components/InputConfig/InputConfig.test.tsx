import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InputMapping } from '../../../types';
import { InputEvent } from '../../input/types';
import { installIpcMock, IpcMock } from '../../hooks/test-support';
import { InputConfig } from './InputConfig';
import { useInputConfig } from './useInputConfig';

const { settings, busListeners, listDevicesMock } = vi.hoisted(() => ({
  settings: {
    selectedDevice: {
      id: 'midi:Pad',
      name: 'Pad',
      sourceId: 'midi',
      port: 1,
    } as {
      id: string;
      name: string;
      sourceId: string;
      port?: number;
    } | null,
    setSelectedDevice: vi.fn(),
    inputMapping: {
      snare: ['midi:38'],
      kick: [],
      hihat: [],
      ride: [],
      crash: [],
      tom1: [],
      tom2: [],
      tom3: [],
    } as InputMapping,
    assignControl: vi.fn(),
    removeControl: vi.fn(),
  },
  busListeners: new Set<(event: InputEvent) => void>(),
  listDevicesMock: vi.fn(),
}));

vi.mock('../../context/AppContext', () => ({
  useApp: () => settings,
}));

vi.mock('../../input', () => ({
  inputBus: {
    capture: (listener: (event: InputEvent) => void) => {
      busListeners.add(listener);

      return () => {
        busListeners.delete(listener);
      };
    },
    listDevices: () => listDevicesMock(),
  },
  controlSource: (id: string) => id.slice(0, id.indexOf(':')),
  controlLabel: (id: string) => id.slice(id.indexOf(':') + 1),
}));

let ipc: IpcMock;

function InputConfigModal({ isOpen }: { isOpen: boolean }) {
  const props = useInputConfig(isOpen);

  return <InputConfig isOpen={isOpen} onClose={() => {}} {...props} />;
}

function press(controlId: string) {
  act(() =>
    busListeners.forEach((listener) => listener({ controlId, value: 100 })),
  );
}

async function renderModal() {
  let view!: ReturnType<typeof render>;

  await act(async () => {
    view = render(<InputConfigModal isOpen />);
  });

  return view;
}

beforeEach(() => {
  ipc = installIpcMock();
  settings.assignControl.mockClear();
  settings.removeControl.mockClear();
  settings.setSelectedDevice.mockClear();
  listDevicesMock.mockResolvedValue([
    { id: 'midi:Pad', name: 'Pad', sourceId: 'midi', port: 1 },
  ]);
  (
    HTMLElement.prototype as unknown as { showPopover: () => void }
  ).showPopover = vi.fn();
  (
    HTMLElement.prototype as unknown as { hidePopover: () => void }
  ).hidePopover = vi.fn();
});

function sentChannels() {
  return ipc.sent.map((s) => s.channel);
}

describe('InputConfig', () => {
  it('does not manage the shared midi stream lifecycle itself', async () => {
    const { rerender } = await renderModal();

    act(() => {
      rerender(<InputConfigModal isOpen={false} />);
    });

    expect(sentChannels()).not.toContain('listen-midi');
    expect(sentChannels()).not.toContain('stop-listen-midi');
  });

  it('ignores incoming controls until an element is in learn mode', async () => {
    await renderModal();

    press('midi:50');

    expect(settings.assignControl).not.toHaveBeenCalled();
  });

  it('clears the selected device when it is no longer in the device list', async () => {
    listDevicesMock.mockResolvedValue([
      { id: 'midi:Other', name: 'Other Device', sourceId: 'midi', port: 2 },
    ]);

    await act(async () => {
      render(<InputConfigModal isOpen />);
    });

    expect(settings.setSelectedDevice).toHaveBeenCalledWith(null);
  });

  it('keeps the selected device when it is still in the device list', async () => {
    await act(async () => {
      render(<InputConfigModal isOpen />);
    });

    expect(settings.setSelectedDevice).not.toHaveBeenCalledWith(null);
  });

  it('re-lists devices when the refresh button is clicked', async () => {
    await act(async () => {
      render(<InputConfigModal isOpen />);
    });

    listDevicesMock.mockClear();

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Refresh device list'));
    });

    expect(listDevicesMock).toHaveBeenCalledTimes(1);
  });

  it('assigns the next learned control to the chosen element', async () => {
    await renderModal();

    fireEvent.click(screen.getAllByText('Learn')[0]);

    press('midi:50');

    expect(settings.assignControl).toHaveBeenCalledWith('hihat', 'midi:50');
  });

  function dispatchKey() {
    const event = new KeyboardEvent('keydown', {
      code: 'Space',
      bubbles: true,
      cancelable: true,
    });

    window.dispatchEvent(event);

    return event;
  }

  it('does not suppress default key actions when not learning', async () => {
    await renderModal();

    expect(dispatchKey().defaultPrevented).toBe(false);
  });

  it('suppresses default key actions while learning so the focused button is not re-triggered', async () => {
    await renderModal();

    fireEvent.click(screen.getAllByText('Learn')[0]);

    expect(dispatchKey().defaultPrevented).toBe(true);
  });

  it('stops suppressing default key actions once a control is learned', async () => {
    await renderModal();

    fireEvent.click(screen.getAllByText('Learn')[0]);
    press('midi:50');

    expect(dispatchKey().defaultPrevented).toBe(false);
  });
});
