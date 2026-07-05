import type { Decorator, Meta, StoryObj } from '@storybook/react';
import { StemToolsStatus } from '../../../types';
import { StemToolsProvider } from '../../context/StemToolsContext';
import { AppProvider } from '../../context/AppContext';
import { SongListSettings } from './SongListSettings';

const noop = () => {};

type StemToolsValue = Parameters<typeof StemToolsProvider>[0]['value'];

function stemTools(overrides: Partial<StemToolsValue> = {}): StemToolsValue {
  return {
    stemToolsStatus: 'ready' as StemToolsStatus,
    stemToolsLoading: false,
    downloadPercent: undefined,
    phase: undefined,
    installedVersion: '1.2.0',
    latestVersion: undefined,
    updateAvailable: false,
    available: undefined,
    downloadSize: undefined,
    uncompressedSize: undefined,
    download: noop,
    cancel: noop,
    deleteTools: noop,
    ...overrides,
  };
}

function withStemTools(overrides: Partial<StemToolsValue>): Decorator {
  return (Story) => (
    <StemToolsProvider value={stemTools(overrides)}>
      <Story />
    </StemToolsProvider>
  );
}

const meta: Meta<typeof SongListSettings> = {
  title: 'Settings/Song List Settings',
  component: SongListSettings,
  args: {
    scanPercent: undefined,
    onSetupInput: () => {},
  },
  decorators: [
    (Story) => (
      <AppProvider>
        <StemToolsProvider value={stemTools()}>
          <div className="p-6">
            <div className="border border-border rounded-xl shadow-panel bg-bg p-3 flex flex-col gap-3 min-w-90 w-max">
              <Story />
            </div>
          </div>
        </StemToolsProvider>
      </AppProvider>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof SongListSettings>;

export const NoFolder: Story = {};

export const Scanning: Story = { args: { scanPercent: 42 } };

export const NoToolsAvailable: Story = {
  decorators: [
    withStemTools({
      stemToolsStatus: 'download',
      installedVersion: undefined,
      available: false,
    }),
  ],
};

export const ToolsDownloading: Story = {
  decorators: [
    withStemTools({
      stemToolsStatus: 'download',
      installedVersion: undefined,
      stemToolsLoading: true,
      phase: 'downloading',
      downloadPercent: 35,
    }),
  ],
};

export const ToolsInstalled: Story = {
  decorators: [
    withStemTools({ stemToolsStatus: 'ready', installedVersion: '1.2.0' }),
  ],
};

export const ToolsUpdateAvailable: Story = {
  decorators: [
    withStemTools({
      stemToolsStatus: 'ready',
      installedVersion: '1.0.0',
      updateAvailable: true,
      latestVersion: '1.2.3',
      downloadSize: 280_000_000,
      uncompressedSize: 700_000_000,
    }),
  ],
};
