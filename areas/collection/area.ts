import { CollectionScreen } from "./Collection.screen.tsx";

export const collectionArea = {
  id: "collection",
  route: "/collection",
  nav: "Collection",
  view: CollectionScreen,
  sidebar: false,
} as const;
