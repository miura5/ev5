import { paletteEntries, type PaletteEntry } from "../commands/client.ts";

/** Commands the palette leaves to Places and the Tab hand-off, which already do them. */
const PLACE_COMMANDS = new Set(["nav.go", "ask.send"]);

/** The registry's palette entries for the area Matt is in (§ui.palette); absent `places` means everywhere. */
export const commandsFor = (
  areaId: string | undefined,
  entries: readonly PaletteEntry[] = paletteEntries,
) =>
  entries.filter(
    (e) =>
      !PLACE_COMMANDS.has(e.name) &&
      (!e.places || (areaId && e.places.includes(areaId))),
  );
