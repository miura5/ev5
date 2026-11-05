import { Button, Empty, Glyph, Page, Row, Section } from "../../kit/index.ts";
import type { SetPageData } from "./types.ts";

export interface SetPageViewProps {
  set: SetPageData;
  onStudy?: () => void;
  onBack?: () => void;
}

/** A set's page in view mode: title, Study, then its items with answers (browsing his own set shows them). */
export function SetPageView({ set, onStudy, onBack }: SetPageViewProps) {
  return (
    <Page
      title={set.title}
      meta={set.meta}
      glyph={<Glyph type={set.kind} />}
      crumb={
        onBack ? (
          <Button kind="text" onClick={onBack}>
            ← Library
          </Button>
        ) : undefined
      }
      actions={
        <Button kind="primary" onClick={onStudy}>
          Study
        </Button>
      }
    >
      <Section label="Items">
        {set.items.length === 0 ? (
          <Empty line="No items yet." />
        ) : (
          set.items.map((it) => (
            <Row key={it.id} title={it.front} meta={it.back || undefined} />
          ))
        )}
      </Section>
    </Page>
  );
}
