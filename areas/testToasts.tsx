import {
  useCallback,
  useState,
  type ComponentType,
  type ReactElement,
} from "react";
import { Toast } from "../kit/index.ts";

interface Item {
  id: number;
  message: string;
  onUndo?: () => void;
}
type OnToast = (message: string, onUndo?: () => void) => void;

let next = 0;

/** Stands in for the shell's toast host in tests: draws what a screen passes to onToast with the kit Toast, each closing itself. */
export function withToasts<P extends { onToast?: OnToast }>(
  Screen: ComponentType<P>,
): (props: Omit<P, "onToast">) => ReactElement {
  return function Hosted(props) {
    const [items, setItems] = useState<readonly Item[]>([]);
    const show = useCallback<OnToast>(
      (message, onUndo) =>
        setItems((l) => [
          ...l.filter((t) => t.message !== message),
          { id: ++next, message, onUndo },
        ]),
      [],
    );
    const drop = (id: number) => setItems((l) => l.filter((t) => t.id !== id));
    return (
      <>
        <Screen {...(props as P)} onToast={show} />
        {items.map((t) => (
          <Toast
            key={t.id}
            message={t.message}
            onUndo={
              t.onUndo
                ? () => {
                    t.onUndo?.();
                    drop(t.id);
                  }
                : undefined
            }
            onDone={() => drop(t.id)}
          />
        ))}
      </>
    );
  };
}
