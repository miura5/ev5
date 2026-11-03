import { NotesScreen } from "./Notes.screen.tsx";

export const notesArea = {
  id: "notes",
  route: "/notes",
  nav: "Notes",
  view: NotesScreen,
} as const;
