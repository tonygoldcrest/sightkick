import '@testing-library/jest-dom/vitest';

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}

    unobserve() {}

    disconnect() {}
  };
}

if (typeof window.matchMedia !== 'function') {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: undefined,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;
}

const POPOVER_OPEN_ATTR = 'data-test-popover-open';

if (typeof HTMLElement.prototype.showPopover !== 'function') {
  HTMLElement.prototype.showPopover = function showPopover(this: HTMLElement) {
    this.setAttribute(POPOVER_OPEN_ATTR, '');
  };
  HTMLElement.prototype.hidePopover = function hidePopover(this: HTMLElement) {
    this.removeAttribute(POPOVER_OPEN_ATTR);
  };
  HTMLElement.prototype.togglePopover = function togglePopover(
    this: HTMLElement,
  ) {
    if (this.hasAttribute(POPOVER_OPEN_ATTR)) {
      this.removeAttribute(POPOVER_OPEN_ATTR);
    } else {
      this.setAttribute(POPOVER_OPEN_ATTR, '');
    }

    return this.hasAttribute(POPOVER_OPEN_ATTR);
  };

  const originalMatches = Element.prototype.matches;

  Element.prototype.matches = function matches(
    this: Element,
    selector: string,
  ) {
    if (selector === ':popover-open') {
      return this.hasAttribute(POPOVER_OPEN_ATTR);
    }

    return originalMatches.call(this, selector);
  } as typeof Element.prototype.matches;
}

const nativeGetComputedStyle = window.getComputedStyle.bind(window);

window.getComputedStyle = ((element: Element) =>
  nativeGetComputedStyle(element)) as typeof window.getComputedStyle;

if (typeof Element.prototype.scrollTo !== 'function') {
  Element.prototype.scrollTo = () => {};
}

if (typeof Element.prototype.scrollIntoView !== 'function') {
  Element.prototype.scrollIntoView = () => {};
}
