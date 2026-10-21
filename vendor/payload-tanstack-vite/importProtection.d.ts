/**
 * Specifiers that must never appear in the client module graph. These are the
 * server-only Payload entry points plus Node.js built-ins and a handful of
 * Node-only npm packages that Payload pulls in transitively.
 */
export declare const serverOnlyClientSpecifiers: Array<RegExp | string>;
/**
 * Allowlist callback for the `tanstackStart` plugin's import-protection. These
 * are the legitimate cross-environment imports in our monorepo that we want
 * to permit even when they appear to cross a server/client boundary.
 */
export declare function onImportProtectionViolation(violation: unknown): boolean | void;
export declare const defaultImportProtectionIgnoreImporters: RegExp[];
//# sourceMappingURL=importProtection.d.ts.map