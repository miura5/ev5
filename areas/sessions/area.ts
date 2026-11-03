import { SessionsScreen } from "./Sessions.screen.tsx";

export const sessionsArea = {
  id: "sessions",
  route: "/sessions",
  nav: "Sessions",
  view: SessionsScreen,
} as const;
