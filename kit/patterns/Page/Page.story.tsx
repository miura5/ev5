import { Button } from "../../components/Button/Button";
import { Empty } from "../Empty/Empty";
import { Section } from "../Section/Section";
import { Page } from "./Page";

export function Story() {
  return (
    <div data-ui="story-page">
      <Page
        title="Library"
        meta="the sets you study"
        crumb={<Button kind="text">Back</Button>}
        actions={<Button kind="primary">New set</Button>}
      >
        <Section label="Sets" count="2" onAdd={() => undefined}>
          <Empty line="No sets yet." action="Start a set" onAction={() => undefined} />
        </Section>
        <Section label="Exams">
          <Empty line="No exams yet." />
        </Section>
      </Page>
    </div>
  );
}
