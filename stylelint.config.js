// Tokens only (CONTRACT §ui.kit-leads): colour, type, space, radius, duration and easing
// come from kit/tokens/tokens.css, which is the one file allowed to define them.
export default {
  ignoreFiles: ["dist/**", "docs/**", ".claude/**", "design/**"],
  rules: {
    "color-no-hex": true,
    "function-disallowed-list": ["rgb", "rgba", "hsl", "hsla", "hwb", "lab", "lch", "oklab", "oklch", "color-mix", "cubic-bezier"],
    "color-named": "never",
    "declaration-property-value-allowed-list": {
      "/^(color|background(-color)?|border(-.*)?-color|outline-color|fill|stroke)$/": ["/^var\\(--/", "transparent", "currentColor", "inherit", "none"],
      "/^(font-size|font-weight|line-height|font-family|letter-spacing)$/": ["/^var\\(--/", "inherit"],
      "/^(margin|padding|gap|row-gap|column-gap)(-.*)?$/": ["/^(var\\(--[^)]*\\)|0|auto)( (var\\(--[^)]*\\)|0|auto))*$/"],
      "/^(border-radius|border-.*-radius)$/": ["/^(var\\(--[^)]*\\)|0)( (var\\(--[^)]*\\)|0))*$/"],
      "/^(transition|animation)(-duration|-timing-function|-delay)?$/": ["/^(?!.*(\\d(ms|s)\\b|cubic-bezier|(?<!-)\\b(ease|linear|step-start|step-end)|steps\\())/"],
    },
  },
  overrides: [
    {
      // Screens do not draw their own rows, page heads, sections, empty states or panels, and do not restyle the kit
      // (§ui.kit-leads): a look a screen lacks goes into kit/ first. Row heights are the kit's tokens (--row, --row2).
      // The one narrow exception: .ev-notes-empty is ProseMirror's placeholder line inside the editor, not a screen empty state.
      files: ["areas/**/*.css"],
      rules: {
        "selector-disallowed-list": [
          [
            "/\\.kit-/",
            "/\\.(?!ev-notes-empty(?![\\w-]))(?:[a-z0-9]+-)*(?:rows?|heads?|headers?|sections?|empty|panels?)(?![a-z0-9])/",
          ],
          { message: "A screen draws no row, page head, section, empty state or panel, and sets no rule on a .kit- class: add it to kit/ first (§ui.kit-leads)." },
        ],
        "declaration-property-value-disallowed-list": [{ "/.*/": ["/var\\(--row2?(?![\\w-])/"] }, { message: "Row heights belong to the kit's Row (§ui.kit-leads)." }],
      },
    },
    { files: ["kit/tokens/tokens.css"], rules: { "color-no-hex": null, "function-disallowed-list": null, "color-named": null, "declaration-property-value-allowed-list": null } }],
};
