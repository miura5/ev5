// The project types only vite/client, so the few Node names the e2e runner and its offline test use are declared here.
declare const process: { env: Record<string, string | undefined>; exit(code: number): never };
declare module "node:test" {
  export function test(name: string, fn: () => unknown): void;
}
declare module "node:assert/strict" {
  const assert: {
    ok(v: unknown, msg?: string): void;
    equal(a: unknown, b: unknown): void;
    deepEqual(a: unknown, b: unknown): void;
  };
  export default assert;
}
