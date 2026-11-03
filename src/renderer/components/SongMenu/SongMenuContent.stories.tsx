import type { Meta, StoryObj } from '@storybook/react';
import { SongMenuContent } from './SongMenuContent';

const meta: Meta<typeof SongMenuContent> = {
  title: 'Song List/Song Menu',
  component: SongMenuContent,
  args: {
    showSplit: true,
    splitting: false,
    onOpenDirectory: () => {},
    onSplit: () => {},
    onDelete: () => {},
  },
  argTypes: {
    showSplit: { control: 'boolean' },
    splitting: { control: 'boolean' },
  },
  decorators: [
    (Story) => (
      <div className="p-6">
        <div className="border border-border rounded-xl shadow-panel flex flex-col w-max bg-bg">
          <Story />
        </div>
      </div>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof SongMenuContent>;

export const WithSplit: Story = {};

export const SplitInProgress: Story = { args: { splitting: true } };

export const WithoutSplit: Story = { args: { showSplit: false } };
