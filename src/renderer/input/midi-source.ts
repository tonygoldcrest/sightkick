import { MidiDevice, MidiMessage, MidiMessageType } from '../../types';
import { InputDevice, InputEvent, InputSource } from './types';
import { makeControlId } from './helpers';

export class MidiSource implements InputSource {
  readonly id = 'midi' as const;

  start(emit: (event: InputEvent) => void): () => void {
    return window.electron.ipcRenderer.on<MidiMessage>(
      'listen-midi',
      ({ type, note, velocity }) => {
        if (type !== MidiMessageType.NoteOn || velocity === 0) {
          return;
        }

        emit({ controlId: makeControlId('midi', note), value: velocity });
      },
    );
  }

  listDevices(): Promise<InputDevice[]> {
    return new Promise((resolve) => {
      window.electron.ipcRenderer.once<MidiDevice[]>(
        'midi-device-list',
        (list) => {
          resolve(
            list.map((device) => ({
              id: makeControlId('midi', device.name),
              name: device.name,
              sourceId: 'midi',
              port: device.port,
            })),
          );
        },
      );
      window.electron.ipcRenderer.sendMessage('midi-device-list');
    });
  }
}
