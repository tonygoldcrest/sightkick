export class TimeStore {
  private time = 0;

  private listeners = new Set<() => void>();

  get = (): number => this.time;

  set = (time: number): void => {
    if (time === this.time) {
      return;
    }

    this.time = time;
    this.listeners.forEach((listener) => listener());
  };

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  };
}
