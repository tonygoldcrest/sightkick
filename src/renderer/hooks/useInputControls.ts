import { useEffect, useRef } from 'react';
import { ElementMapping, InputElement } from '../../types';
import { inputBus } from '../input';

export type InputControlHandlers = Partial<Record<InputElement, () => void>>;

export function useInputControls(
  mapping: ElementMapping,
  handlers: InputControlHandlers,
  enabled = true,
  blockedControlIds?: Set<string>,
): void {
  const mappingRef = useRef(mapping);
  const handlersRef = useRef(handlers);
  const enabledRef = useRef(enabled);
  const blockedRef = useRef(blockedControlIds);

  useEffect(() => {
    mappingRef.current = mapping;
  }, [mapping]);

  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  useEffect(() => {
    blockedRef.current = blockedControlIds;
  }, [blockedControlIds]);

  useEffect(() => {
    return inputBus.subscribe(({ controlId, value }) => {
      if (!enabledRef.current || value === 0) {
        return;
      }

      if (blockedRef.current?.has(controlId)) {
        return;
      }

      const map = mappingRef.current;
      const element = (Object.keys(map) as InputElement[]).find(
        (key) => map[key]?.includes(controlId),
      );

      if (element) {
        handlersRef.current[element]?.();
      }
    });
  }, []);
}
