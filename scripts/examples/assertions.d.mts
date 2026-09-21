// Types for assertions.mjs, which the docs theme imports to mark the answers the checker asserts.
import type ts from "typescript";

export function isLiteral(node: ts.Node): boolean;
export function expectation(text: string, statement: ts.Node): string | null;
export function withAssertions(code: string, where: string): string;
