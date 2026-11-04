// The registry's public door for the server (CONTRACT §cmd.registry, §drift.imports). Screens use client.ts instead.
export { byName, commands } from "./catalog.ts";
export { resolveCall, suggest } from "./define.ts";
export type { Caller } from "./define.ts";
/** @public The generated tool list and ⌘K entries (CONTRACT §cmd.generated); the Ask job and the palette consume them later. */
export { tools, paletteEntries } from "./catalog.ts";
