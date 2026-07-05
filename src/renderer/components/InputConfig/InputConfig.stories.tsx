import type { Meta, StoryObj } from '@storybook/react';
import { ElementMapping } from '../../../types';
import { InputDevice } from '../../input';
import { InputConfig } from './InputConfig';

const devices: InputDevice[] = [
  { id: 'midi:TD-17', name: 'Roland TD-17', sourceId: 'midi', port: 1 },
  { id: 'midi:SPD', name: 'Roland SPD-SX', sourceId: 'midi', port: 2 },
];
const mapping: ElementMapping = {
  snare: ['midi:38'],
  kick: ['midi:36', 'keyboard:Space'],
  hihat: ['midi:46'],
  ride: [],
  crash: [],
  tom1: ['midi:48'],
  tom2: [],
  tom3: [],
  pause: ['keyboard:Escape'],
};
const meta: Meta<typeof InputConfig> = {
  title: 'Settings/Input Config',
  component: InputConfig,
  args: {
    isOpen: true,
    devices,
    selectedDeviceId: 'midi:TD-17',
    mapping,
    listeningTo: undefined,
    onClose: () => {},
    onSelectDevice: () => {},
    onLearn: () => {},
    onStopLearn: () => {},
    onRemoveControl: () => {},
    onRefreshDevices: () => {},
  },
};

export default meta;

type Story = StoryObj<typeof InputConfig>;

export const Mapped: Story = {};

export const Empty: Story = {
  args: { mapping: {}, selectedDeviceId: undefined },
};

export const Listening: Story = { args: { listeningTo: 'snare' } };

export const NoDevice: Story = {
  args: { devices: [], selectedDeviceId: undefined },
};
