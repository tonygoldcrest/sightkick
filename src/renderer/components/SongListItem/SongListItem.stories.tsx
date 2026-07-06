import type { Meta, StoryObj } from '@storybook/react';
import { Song } from '../../../types';
import { SongListItem } from './SongListItem';

const songData = {
  id: 'song-1',
  dir: '/songs/master-of-puppets',
  name: 'Master of Puppets',
  artist: 'Metallica',
  charter: 'DrumCharter',
  drumDifficulty: 5,
  liked: false,
  audio: [{ src: 'song.ogg', name: 'song' }],
  scoreData: {
    expert: { hitNotes: 92, totalNotes: 100, falseHits: 3 },
  },
} as unknown as Song;
const meta: Meta<typeof SongListItem> = {
  title: 'Song List/Song List Item',
  component: SongListItem,
  args: {
    songData,
    difficulty: 'expert',
    libraryMode: 'local',
    splitting: false,
    downloadingDisabled: false,
    onLikeChange: () => {},
    onDownload: () => {},
    onSplit: () => {},
  },
  decorators: [
    (Story) => (
      <div className="bg-bg p-4" style={{ width: 760 }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof SongListItem>;

export const Local: Story = {};

export const Liked: Story = {
  args: { songData: { ...songData, liked: true } },
};

export const Focused: Story = { args: { focused: true } };

export const Online: Story = { args: { libraryMode: 'online' } };

export const Downloading: Story = {
  args: { libraryMode: 'online', downloading: true },
};

export const Downloaded: Story = {
  args: { libraryMode: 'online', downloaded: true },
};

export const DownloadDisabled: Story = {
  args: { libraryMode: 'online', downloadingDisabled: true },
};
