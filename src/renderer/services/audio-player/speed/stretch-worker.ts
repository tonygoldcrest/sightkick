import {
  buildUnits,
  scatterBlocks,
  StretchUnit,
  VoiceGroup,
} from './build-units';

type InitMessage = {
  type: 'init';
  channels: Float32Array[];
  speed: number;
  groups: VoiceGroup[];
  sampleRate: number;
};

type SetSpeedMessage = { type: 'setSpeed'; speed: number };

type SeekMessage = { type: 'seek'; outputSample: number };

type ProduceMessage = { type: 'produce'; id: number; frames: number };

type RequestMessage =
  | InitMessage
  | SetSpeedMessage
  | SeekMessage
  | ProduceMessage;

let channels: Float32Array[] = [];
let groups: VoiceGroup[] = [];
let sampleRate = 44100;
let onsetsByGroup: (number[] | undefined)[] = [];
let units: StretchUnit[] = [];

self.onmessage = (event: MessageEvent<RequestMessage>) => {
  const message = event.data;

  switch (message.type) {
    case 'init':
      channels = message.channels;
      groups = message.groups;
      sampleRate = message.sampleRate;
      onsetsByGroup = new Array(groups.length).fill(undefined);
      units = buildUnits(
        channels,
        groups,
        message.speed,
        sampleRate,
        onsetsByGroup,
      );

      break;

    case 'setSpeed':
      units = buildUnits(
        channels,
        groups,
        message.speed,
        sampleRate,
        onsetsByGroup,
      );

      break;

    case 'seek':
      units.forEach((unit) => unit.seek(message.outputSample));

      break;

    case 'produce': {
      const blocks = scatterBlocks(units, channels.length, message.frames);

      (self as unknown as Worker).postMessage(
        { id: message.id, blocks },
        blocks.map((block) => block.buffer),
      );

      break;
    }

    default:
      break;
  }
};
