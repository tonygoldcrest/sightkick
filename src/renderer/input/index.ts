import { InputBus } from './input-bus';
import { MidiSource } from './midi-source';
import { KeyboardSource } from './keyboard-source';

export const inputBus = new InputBus([new MidiSource(), new KeyboardSource()]);

export { InputBus } from './input-bus';

export * from './types';

export * from './helpers';
