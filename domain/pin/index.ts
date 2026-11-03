// domain/pin: Matt's pins (the sidebar list, in order); a pin to a deleted item is hidden, not lost.
export type { TargetState } from './types.ts';
export { parsePin } from './parse.ts';
export { pinOrder, isPinned, pin, unpin, movePin, visiblePins, orphanPins } from './rules.ts';
