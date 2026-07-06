import type { Meta, StoryObj } from '@storybook/react';
import { SongFilter } from './SongFilter';

const meta: Meta<typeof SongFilter> = {
  title: 'Song List/Song Filter',
  component: SongFilter,
  args: {
    nameFilter: '',
    difficulty: 'expert',
    filteredSongsCount: 42,
    libraryMode: 'local',
    onChangeFilter: () => {},
    onChangeLibraryMode: () => {},
    setDifficulty: () => {},
  },
  argTypes: {
    libraryMode: { control: 'radio', options: ['local', 'online'] },
    difficulty: {
      control: 'radio',
      options: ['easy', 'medium', 'hard', 'expert'],
    },
    filteredSongsCount: { control: { type: 'number' } },
  },
  decorators: [
    (Story) => (
      <div className="bg-bg p-4" style={{ width: 720 }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof SongFilter>;

export const Local: Story = {};

export const Online: Story = {
  args: { libraryMode: 'online', filteredSongsCount: 1280 },
};

export const WithQuery: Story = {
  args: { nameFilter: 'master of puppets', filteredSongsCount: 3 },
};
