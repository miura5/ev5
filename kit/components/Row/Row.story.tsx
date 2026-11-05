import { useState } from "react";
import { Glyph } from "../Glyph/Glyph";
import { Button } from "../Button/Button";
import { Meter } from "../Meter/Meter";
import { EditorRow, Row } from "./Row";

const MENU = [
  { key: "pin", label: "Pin", hint: "P" },
  { key: "delete", label: "Delete", hint: "⌫", danger: true },
];

export function Story() {
  const [open, setOpen] = useState(true);
  const [term, setTerm] = useState("Heparin");
  const [meaning, setMeaning] = useState("Anticoagulant; watch aPTT");
  const [step, setStep] = useState("Check the order");
  return (
    <div data-ui="story-row">
      <Row
        title="Heparin and warfarin"
        meta="12 cards · NUR 112"
        value="3 due"
        onOpen={() => undefined}
        actions={
          <Button kind="icon" aria-label="More">
            ⋯
          </Button>
        }
        menu={{ items: MENU, onPick: () => undefined, label: "Row actions" }}
      />
      <Row title="Fluid balance" value="Yesterday" selected />
      <Row title="Add a note" />
      <Row
        title="Quiz on electrolytes"
        status={{ tone: "warn", label: "Due soon" }}
        value="Fri"
      />
      <Row title="Read chapter 4" done />
      <Row
        title="Pharmacology"
        fold={{ open, onToggle: () => setOpen(!open) }}
      />
      {open ? <Row title="Anticoagulants" level={1} /> : null}
      {open ? (
        <Row title="Heparin notes" level={2} glyph={<Glyph type="note" />} />
      ) : null}
      <Row
        title="Monthly spend alert"
        meta="80% of the ceiling"
        actionsShown
        actions={<Button kind="secondary">Got it</Button>}
      />
      <Row
        title="Lab values"
        onOpen={() => undefined}
        actionsShown
        menu={{
          items: MENU,
          onPick: () => undefined,
          label: "Actions for Lab values",
          button: true,
        }}
      />
      <EditorRow
        cells={[
          { label: "Term", value: term, onChange: setTerm },
          { label: "Meaning", value: meaning, onChange: setMeaning },
        ]}
        actions={
          <Button kind="icon" aria-label="Remove line">
            ×
          </Button>
        }
      />
      <Row
        title="Heart failure"
        meta="Due Friday"
        value="Tomorrow"
        bar={
          <Meter
            label="Right 60%, shaky 30%, wrong 10%"
            parts={[
              { tone: "ok", count: 6 },
              { tone: "warn", count: 3 },
              { tone: "bad", count: 1 },
            ]}
          />
        }
      />
      <EditorRow
        cells={[{ label: "Step", value: step, onChange: setStep }]}
        actions={
          <Button kind="icon" aria-label="Remove step">
            ×
          </Button>
        }
      />
      <div data-focus-shown style={{ display: "contents" }}>
        <Row title="Focused row" onOpen={() => undefined} />
      </div>
    </div>
  );
}
