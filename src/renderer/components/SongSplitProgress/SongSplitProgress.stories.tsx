import type { Meta, StoryObj } from '@storybook/react';
import { Song } from '../../../types';
import { SongSplitProgress } from './SongSplitProgress';

const songData = {
  name: 'Master of Puppets',
} as Song;
const meta: Meta<typeof SongSplitProgress> = {
  title: 'Song List/Song Split Progress',
  component: SongSplitProgress,
  args: {
    songData,
    progress: 50,
    onCancel: () => {},
  },
  argTypes: {
    progress: { control: { type: 'range', min: 0, max: 100, step: 1 } },
  },
  decorators: [
    (Story) => (
      <div className="bg-bg p-4" style={{ width: 320 }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof SongSplitProgress>;

export const Start: Story = { args: { progress: 0 } };

export const Half: Story = { args: { progress: 50 } };

export const AlmostDone: Story = { args: { progress: 95 } };
