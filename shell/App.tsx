import { HelloView } from "../areas/hello/Hello.view.tsx";
import { KitGallery } from "./KitGallery.tsx";

export function App({ path }: { path: string }) {
  return path === "/kit" ? <KitGallery /> : <HelloView />;
}
