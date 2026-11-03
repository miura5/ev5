import { useState } from "react";
import { THEMES, type Theme } from "../kit/index.ts";
import "./kit-gallery.css";

const COLOURS = [
  "--side",
  "--bg",
  "--surface",
  "--hover",
  "--sel",
  "--line",
  "--line2",
  "--text",
  "--quiet",
  "--faint",
  "--her",
  "--her2",
  "--on-her",
  "--ok",
  "--warn",
  "--bad",
  "--info",
] as const;
const SIZES = [
  ["title", "--fs-title", "20"],
  ["body", "--fs-body", "14"],
  ["meta", "--fs-meta", "12"],
] as const;
const SPACES = [
  "--sp-1",
  "--sp-2",
  "--sp-3",
  "--sp-4",
  "--sp-6",
  "--sp-8",
  "--sp-12",
  "--sp-14",
] as const;
const RADII = ["--r-sm", "--r-md", "--r-lg", "--r-pill"] as const;
const DURATIONS = ["--dur-1", "--dur-2", "--dur-3"] as const;

export function KitGallery() {
  const [theme, setTheme] = useState<Theme>("dark");
  const next: Theme = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length]!;
  return (
    <main className="gallery" data-theme={theme} data-ui="kit-gallery">
      <div className="gallery-col">
        <header className="gallery-head">
          <h1>Kit</h1>
          <button
            type="button"
            className="gallery-toggle"
            data-ui="theme-toggle"
            onClick={() => setTheme(next)}
          >
            {`Theme: ${theme}, switch to ${next}`}
          </button>
        </header>
        <section aria-label="Colour" data-key="colour">
          <h2>Colour</h2>
          <div className="gallery-grid">
            {COLOURS.map((token) => (
              <div className="gallery-swatch" key={token}>
                <div
                  className="gallery-chip"
                  style={{ background: `var(${token})` }}
                />
                <span className="gallery-name">{token}</span>
              </div>
            ))}
          </div>
        </section>
        <section aria-label="Text" data-key="text">
          <h2>Text</h2>
          {SIZES.map(([name, token, px]) => (
            <div className="gallery-row" key={token}>
              <span
                style={{ fontSize: `var(${token})` }}
              >{`E.V. ${name}, ${px}`}</span>
              <span className="gallery-name">{token}</span>
            </div>
          ))}
        </section>
        <section aria-label="Space" data-key="space">
          <h2>Space</h2>
          {SPACES.map((token) => (
            <div className="gallery-row" key={token}>
              <div
                className="gallery-space"
                style={{ width: `var(${token})` }}
              />
              <span className="gallery-name">{token}</span>
            </div>
          ))}
        </section>
        <section aria-label="Radius" data-key="radius">
          <h2>Radius</h2>
          <div className="gallery-row">
            {RADII.map((token) => (
              <div key={token}>
                <div
                  className="gallery-radius"
                  style={{ borderRadius: `var(${token})` }}
                />
                <span className="gallery-name">{token}</span>
              </div>
            ))}
          </div>
        </section>
        <section aria-label="Duration" data-key="duration">
          <h2>Duration (hover a bar)</h2>
          {DURATIONS.map((token, i) => (
            <div key={token}>
              <div className="gallery-motion">
                <span className={`dur-${i + 1}`} />
              </div>
              <span className="gallery-name">{token}</span>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
