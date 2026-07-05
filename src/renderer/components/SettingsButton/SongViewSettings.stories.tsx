import type { Decorator, Meta, StoryObj } from '@storybook/react';
import { AppProvider } from '../../context/AppContext';
import { AudioVolume } from '../AudioVolume';
import { SongViewSettings } from './SongViewSettings';

const noop = () => {};
const volumeSliders = [
  <AudioVolume
    key="drums"
    name="drums"
    volume={80}
    isMuted={false}
    isSoloed={false}
    onChange={noop}
    onMuteClick={noop}
    onSoloClick={noop}
  />,
  <AudioVolume
    key="song"
    name="song"
    volume={55}
    isMuted={false}
    isSoloed={false}
    onChange={noop}
    onMuteClick={noop}
    onSoloClick={noop}
  />,
];

function withSettings(overrides: Record<string, unknown> = {}): Decorator {
  return (Story) => {
    window.localStorage.clear();
    Object.entries(overrides).forEach(([key, value]) => {
      window.localStorage.setItem(key, JSON.stringify(value));
    });

    return (
      <AppProvider>
        <div className="p-6">
          <div className="border border-border rounded-xl shadow-panel bg-bg p-3 flex flex-col gap-3 min-w-90 w-max">
            <Story />
          </div>
        </div>
      </AppProvider>
    );
  };
}

const meta: Meta<typeof SongViewSettings> = {
  title: 'Settings/Song View Settings',
  component: SongViewSettings,
  args: {
    onSetupInput: noop,
  },
  decorators: [withSettings()],
};

export default meta;

type Story = StoryObj<typeof SongViewSettings>;

export const Default: Story = {};

export const WithMixer: Story = { args: { volumeSliders } };

export const ColorsOff: Story = {
  decorators: [withSettings({ 'settings.enableColors': false })],
};
