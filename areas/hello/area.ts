import { HelloView } from "./Hello.view.tsx";

export const helloArea = {
  id: "hello",
  route: "/",
  nav: "Hello",
  view: HelloView,
} as const;
