import midi from '@julusian/midi';
import { MidiDevice } from '../../types';

let activeInput: InstanceType<typeof midi.Input> | null = null;

export async function loadMidiDeviceList(event: Electron.IpcMainEvent) {
  const input = new midi.Input();
  const portCount = input.getPortCount();
  const deviceList: MidiDevice[] = [];

  for (let i = 0; i < portCount; i++) {
    deviceList.push({ port: i, name: input.getPortName(i) });
  }

  input.closePort();

  event.reply('midi-device-list', deviceList);
}

export async function listenMidi(event: Electron.IpcMainEvent, port: number) {
  if (activeInput) {
    activeInput.removeAllListeners('message');
    activeInput.closePort();
    activeInput = null;
  }

  const input = new midi.Input();

  activeInput = input;

  input.on('message', (_deltaTime, [status, note, velocity]) => {
    const type = status & 0xf0;
    const channel = status & 0x0f;

    event.reply('listen-midi', { type, note, velocity, channel });
  });

  input.openPort(port);
}

export function stopListenMidi() {
  if (activeInput) {
    activeInput.removeAllListeners('message');
    activeInput.closePort();
    activeInput = null;
  }
}
