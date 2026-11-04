import { useEffect, useState, type ReactNode } from "react";
import { forgetToken, readToken, saveToken, UNAUTHORIZED_EVENT } from "../commands/client.ts";
import { TokenScreen } from "./TokenScreen.tsx";

/** Shows the token screen instead of the app when no token is saved or the server refused it; the app gets the way to change it. */
export function TokenGate({ children }: { children: (useDifferentToken: () => void) => ReactNode }) {
  const [token, setToken] = useState(readToken);
  const [refused, setRefused] = useState(false);
  useEffect(() => {
    const onRefused = () => setRefused(true);
    window.addEventListener(UNAUTHORIZED_EVENT, onRefused);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onRefused);
  }, []);
  if (!token || refused) {
    return (
      <TokenScreen
        refused={refused}
        onSave={(t) => {
          saveToken(t);
          setToken(t);
          setRefused(false);
        }}
      />
    );
  }
  return (
    <>
      {children(() => {
        forgetToken();
        setToken("");
        setRefused(false);
      })}
    </>
  );
}
