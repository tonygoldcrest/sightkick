import { ChannelStretcher } from './channel-stretcher';

type InitMessage = { type: 'init'; channels: Float32Array[]; speed: number };

type SetSpeedMessage = { type: 'setSpeed'; speed: number };

type SeekMessage = { type: 'seek'; outputSample: number };

type ProduceMessage = { type: 'produce'; id: number; frames: number };

type RequestMessage =
  | InitMessage
  | SetSpeedMessage
  | SeekMessage
  | ProduceMessage;

let channels: Float32Array[] = [];
let stretchers: ChannelStretcher[] = [];

self.onmessage = (event: MessageEvent<RequestMessage>) => {
  const message = event.data;

  switch (message.type) {
    case 'init':
      channels = message.channels;
      stretchers = channels.map(
        (channel) => new ChannelStretcher(channel, message.speed),
      );

      break;

    case 'setSpeed':
      stretchers = channels.map(
        (channel) => new ChannelStretcher(channel, message.speed),
      );

      break;

    case 'seek':
      stretchers.forEach((stretcher) => stretcher.seek(message.outputSample));

      break;

    case 'produce': {
      const blocks = stretchers.map((stretcher) =>
        stretcher.produce(message.frames),
      );

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
