import type { Meta, StoryObj } from '@storybook/react';
import { Song } from '../../../types';
import { OnlineSong } from '../../types';
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
const onlineSongData: OnlineSong = {
  source: 'online',
  id: 'song-1',
  downloadUrl: 'https://files.enchor.us/song-1.sng',
  name: 'Master of Puppets',
  artist: 'Metallica',
  charter: 'DrumCharter',
  drumDifficulty: 5,
};
const meta: Meta<typeof SongListItem> = {
  title: 'Song List/Song List Item',
  component: SongListItem,
  args: {
    songData,
    difficulty: 'expert',
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

export const Online: Story = { args: { songData: onlineSongData } };

export const Downloading: Story = {
  args: { songData: onlineSongData, downloading: true },
};

export const Downloaded: Story = {
  args: { songData: onlineSongData, downloaded: true },
};

export const DownloadDisabled: Story = {
  args: { songData: onlineSongData, downloadingDisabled: true },
};
