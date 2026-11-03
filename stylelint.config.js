// Tokens only (CONTRACT §ui.kit-leads): colour, type, space, radius, duration and easing
// come from kit/tokens/tokens.css, which is the one file allowed to define them.
export default {
  ignoreFiles: ["dist/**", "spike/**", "docs/**", ".claude/**", "design/**"],
  rules: {
    "color-no-hex": true,
    "function-disallowed-list": ["rgb", "rgba", "hsl", "hsla", "hwb", "lab", "lch", "oklab", "oklch", "color-mix", "cubic-bezier"],
    "color-named": "never",
    "declaration-property-value-allowed-list": {
      "/^(color|background(-color)?|border(-.*)?-color|outline-color|fill|stroke)$/": ["/^var\\(--/", "transparent", "currentColor", "inherit", "none"],
      "/^(font-size|font-weight|line-height|font-family|letter-spacing)$/": ["/^var\\(--/", "inherit"],
      "/^(margin|padding|gap|row-gap|column-gap)(-.*)?$/": ["/^(var\\(--[^)]*\\)|0|auto)( (var\\(--[^)]*\\)|0|auto))*$/"],
      "/^(border-radius|border-.*-radius)$/": ["/^(var\\(--[^)]*\\)|0)( (var\\(--[^)]*\\)|0))*$/"],
      "/^(transition|animation)(-duration|-timing-function|-delay)?$/": ["/^(?!.*(\\d(ms|s)\\b|cubic-bezier|ease|linear))/"],
    },
  },
  overrides: [{ files: ["kit/tokens/tokens.css"], rules: { "color-no-hex": null, "function-disallowed-list": null, "color-named": null, "declaration-property-value-allowed-list": null } }],
};
