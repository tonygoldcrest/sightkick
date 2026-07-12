import { InputDevice, InputEvent, InputSource } from './types';
import { isTypingTarget, makeControlId } from './helpers';

const KEYBOARD_DEVICE: InputDevice = {
  id: 'keyboard',
  name: 'Keyboard',
  sourceId: 'keyboard',
};

export class KeyboardSource implements InputSource {
  readonly id = 'keyboard' as const;

  start(emit: (event: InputEvent) => void): () => void {
    const handle = (event: KeyboardEvent) => {
      if (
        event.repeat ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        isTypingTarget(event.target)
      ) {
        return;
      }

      emit({ controlId: makeControlId('keyboard', event.code), value: 127 });
    };

    window.addEventListener('keydown', handle);

    return () => window.removeEventListener('keydown', handle);
  }

  listDevices(): Promise<InputDevice[]> {
    return Promise.resolve([KEYBOARD_DEVICE]);
  }
}
