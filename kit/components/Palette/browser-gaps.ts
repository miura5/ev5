// Real browsers have ResizeObserver and scrollIntoView, which cmdk reads when it mounts; this only fills the gap in jsdom,
// so a page that draws the palette (the /kit gallery, the shell) can render in tests.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
Element.prototype.scrollIntoView ??= () => {};
