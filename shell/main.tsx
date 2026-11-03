import { createRoot } from "react-dom/client";
import { HelloView } from "../areas/hello/Hello.view.tsx";

createRoot(document.getElementById("root")!).render(<HelloView />);
