import { useState } from "react";
import { Glyph } from "../../components/Glyph/Glyph";
import { Button } from "../../components/Button/Button";
import { Empty } from "../Empty/Empty";
import { Section } from "../Section/Section";
import { Page } from "./Page";

export function Story() {
  const [name, setName] = useState("Pharmacology");
  return (
    <div data-ui="story-page">
      <Page
        title={name}
        onTitle={setName}
        titlePlaceholder="Untitled collection"
        glyph={<Glyph type="collection" />}
        meta="Collection · 4 items"
      />
      <Page
        title=""
        onTitle={() => undefined}
        titlePlaceholder="Untitled note"
        glyph={<Glyph type="note" />}
      />
      <Page
        title="Library"
        meta="the sets you study"
        crumb={<Button kind="text">Back</Button>}
        actions={<Button kind="primary">New set</Button>}
      >
        <Section label="Sets" count="2" onAdd={() => undefined}>
          <Empty
            line="No sets yet."
            action="Start a set"
            onAction={() => undefined}
          />
        </Section>
        <Section label="Dates">
          <Empty line="No dates yet." />
        </Section>
      </Page>
    </div>
  );
}
