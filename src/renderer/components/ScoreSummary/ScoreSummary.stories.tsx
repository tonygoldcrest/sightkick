import type { Meta, StoryObj } from '@storybook/react';
import { Song } from '../../../types';
import { ScoreSummary } from './ScoreSummary';

const songData = {
  name: 'Master of Puppets',
  artist: 'Metallica',
} as Song;
const meta: Meta<typeof ScoreSummary> = {
  title: 'Song View/Score Summary',
  component: ScoreSummary,
  args: {
    isOpen: true,
    songData,
    difficulty: 'expert',
    scoreData: { hitNotes: 70, totalNotes: 100, falseHits: 5 },
    onRetry: () => {},
    onNextSong: () => {},
  },
};

export default meta;

type Story = StoryObj<typeof ScoreSummary>;

export const ThreeStars: Story = {
  args: { scoreData: { hitNotes: 70, totalNotes: 100, falseHits: 5 } },
};

export const Perfect: Story = {
  args: { scoreData: { hitNotes: 100, totalNotes: 100, falseHits: 0 } },
};

export const NoStars: Story = {
  args: { scoreData: { hitNotes: 5, totalNotes: 100, falseHits: 40 } },
};

export const FullStars: Story = {
  args: { scoreData: { hitNotes: 96, totalNotes: 100, falseHits: 2 } },
};
