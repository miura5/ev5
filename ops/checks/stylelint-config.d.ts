// Types for the plain-JS stylelint config that ops/checks/tokens.test.ts imports.
declare module '*/stylelint.config.js' {
  const config: import('stylelint').Config;
  export default config;
}
