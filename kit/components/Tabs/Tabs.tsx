import * as ToggleGroup from "@radix-ui/react-toggle-group";

export interface TabItem {
  id: string;
  label: string;
  /** How many things sit under this tab; shown quietly after the name. */
  count?: number;
}

export interface TabsProps {
  /** What the tabs switch between, for example "Library". */
  label: string;
  tabs: readonly TabItem[];
  value: string;
  onChange: (id: string) => void;
}

/** A row of views with the lit one underlined; one Tab stop, arrows move between tabs. */
export function Tabs({ label, tabs, value, onChange }: TabsProps) {
  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      // Radix reports "" when the lit tab is tapped again; one tab always stays lit.
      onValueChange={(v) => v && onChange(v)}
      aria-label={label}
      className="kit-tabs"
      data-ui="tabs"
    >
      {tabs.map((t) => (
        <ToggleGroup.Item key={t.id} value={t.id}>
          {t.label}
          {t.count === undefined ? null : (
            <span className="kit-tabs-n">{t.count}</span>
          )}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}
