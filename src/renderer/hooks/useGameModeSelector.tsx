import { Button, Modal } from 'antd';
import { useCallback, useRef, useState } from 'react';
import { useInput } from '../context/InputContext';
import { modalStyles, MODAL_ABOVE_POPOVER_Z_INDEX } from '../overlayStyles';
import { GameMode } from '../types';
import { useInputControls } from './useInputControls';

const GAME_MODES: GameMode[] = ['perform', 'practice'];

export function useGameModeSelector() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedMode, setSelectedMode] = useState<GameMode>('perform');
  const resolveRef = useRef<(gameMode?: GameMode) => void>(undefined);
  const { controlMapping } = useInput();
  const open = useCallback(() => {
    resolveRef.current?.(undefined);
    setSelectedMode('perform');
    setIsOpen(true);

    return new Promise<GameMode | undefined>((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);
  const close = useCallback((gameMode?: GameMode) => {
    setIsOpen(false);
    resolveRef.current?.(gameMode);
    resolveRef.current = undefined;
  }, []);
  const moveFocus = (delta: number) => {
    setSelectedMode(
      (current) =>
        GAME_MODES[
          (GAME_MODES.indexOf(current) + delta + GAME_MODES.length) %
            GAME_MODES.length
        ],
    );
  };

  useInputControls(
    controlMapping,
    {
      up: () => moveFocus(-1),
      down: () => moveFocus(1),
      confirm: () => close(selectedMode),
      back: () => close(),
    },
    isOpen,
  );

  const element = (
    <Modal
      open={isOpen}
      onCancel={() => close()}
      title={<div className="font-semibold text-xl">Select Game Mode</div>}
      footer={null}
      width={560}
      destroyOnHidden
      centered
      styles={modalStyles}
      wrapProps={{ 'data-testid': 'game-mode-selector-modal' }}
      zIndex={MODAL_ABOVE_POPOVER_Z_INDEX}
    >
      <div className="flex flex-col gap-3 items-center">
        {GAME_MODES.map((name) => (
          <Button
            key={name}
            size="large"
            className="w-full"
            type={name === selectedMode ? 'primary' : 'default'}
            onClick={() => close(name)}
          >
            <div className="capitalize">{name}</div>
          </Button>
        ))}
      </div>
    </Modal>
  );

  return { open, isOpen, element };
}
