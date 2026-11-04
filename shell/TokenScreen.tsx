import { useState, type FormEvent } from "react";
import { Button, Field } from "../kit/index.ts";

/** What the screen says after the server refused the token. */
export const REFUSED_SENTENCE = "That token was not accepted. Paste the app token again.";

/** The one screen shown before any area when no token is saved, and again after a refusal. */
export function TokenScreen({ refused, onSave }: { refused: boolean; onSave: (token: string) => void }) {
  const [value, setValue] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const t = value.trim();
    if (t) onSave(t);
  };
  return (
    <main className="shell-token" data-ui="token-screen">
      <form className="shell-token-form" onSubmit={submit}>
        <h1 className="shell-token-title">Paste the app token</h1>
        {refused ? (
          <p role="alert" className="shell-token-line">
            {REFUSED_SENTENCE}
          </p>
        ) : null}
        <Field
          label="App token"
          type="password"
          autoComplete="off"
          autoFocus
          spellCheck={false}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <p className="shell-token-line shell-token-note">The token stays in this browser only.</p>
        <Button kind="primary" type="submit" disabled={!value.trim()}>
          Continue
        </Button>
      </form>
    </main>
  );
}
