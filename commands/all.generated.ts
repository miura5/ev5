// generated, do not edit: node ops/generate/cli.ts

import { itemCommands } from "./item.command.ts";
import { notesCommands } from "./notes.command.ts";
import { planCommands } from "./plan.command.ts";
import { practiceCommands } from "./practice.command.ts";
import { scheduledCommands } from "./scheduled.command.ts";
import { shellCommands } from "./shell.command.ts";

export const all = [...itemCommands, ...notesCommands, ...planCommands, ...practiceCommands, ...scheduledCommands, ...shellCommands] as const;
