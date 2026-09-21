// Turns the `// => literal` comments of a code example into assertions. Pure, so it is unit-tested
// (assertions.test.mjs): a bug here would make the documentation lie without anyone noticing.
import ts from "typescript";

const LITERAL_OPERATORS = new Set([ts.SyntaxKind.MinusToken, ts.SyntaxKind.PlusToken]);
export function isLiteral(node) {
  switch (node.kind) {
    case ts.SyntaxKind.NumericLiteral:
    case ts.SyntaxKind.StringLiteral:
    case ts.SyntaxKind.NoSubstitutionTemplateLiteral:
    case ts.SyntaxKind.TrueKeyword:
    case ts.SyntaxKind.FalseKeyword:
    case ts.SyntaxKind.NullKeyword:
      return true;
    case ts.SyntaxKind.Identifier:
      return ["undefined", "NaN", "Infinity"].includes(node.text);
    case ts.SyntaxKind.PrefixUnaryExpression:
      return LITERAL_OPERATORS.has(node.operator) && isLiteral(node.operand);
    case ts.SyntaxKind.ParenthesizedExpression:
      return isLiteral(node.expression);
    case ts.SyntaxKind.ArrayLiteralExpression:
      return node.elements.every(isLiteral);
    case ts.SyntaxKind.ObjectLiteralExpression:
      return node.properties.every(
        (p) =>
          ts.isPropertyAssignment(p) &&
          (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name) || ts.isNumericLiteral(p.name)) &&
          isLiteral(p.initializer),
      );
    default:
      return false;
  }
}

/** `// => literal` after a statement, or null when there is none (or it is prose). */
export function expectation(text, statement) {
  const [comment] = ts.getTrailingCommentRanges(text, statement.getEnd()) ?? [];
  if (!comment || comment.kind !== ts.SyntaxKind.SingleLineCommentTrivia) return null;
  const m = /^\/\/\s*=>\s*(.+?)\s*$/.exec(text.slice(comment.pos, comment.end));
  if (!m) return null;
  const parsed = ts.createSourceFile("expected.ts", `(${m[1]})`, ts.ScriptTarget.ES2022, false);
  const [only] = parsed.statements;
  const clean = parsed.parseDiagnostics.length === 0 && parsed.statements.length === 1;
  return clean && ts.isExpressionStatement(only) && isLiteral(only.expression) ? m[1] : null;
}

/** The snippet with each `// => literal` turned into an assertion. */
export function withAssertions(code, where) {
  const sf = ts.createSourceFile(
    "snippet.tsx",
    code,
    ts.ScriptTarget.ES2022,
    true,
    ts.ScriptKind.TSX,
  );
  const edits = [];
  for (const statement of sf.statements) {
    const expected = expectation(code, statement);
    if (expected === null) continue;
    if (ts.isExpressionStatement(statement)) {
      const expr = statement.expression.getText(sf);
      edits.push([statement.getStart(sf), statement.getEnd(), `__expect(${expr}, ${expected});`]);
    } else if (
      ts.isVariableStatement(statement) &&
      statement.declarationList.declarations.length === 1 &&
      ts.isIdentifier(statement.declarationList.declarations[0].name)
    ) {
      const name = statement.declarationList.declarations[0].name.text;
      edits.push([statement.getEnd(), statement.getEnd(), ` __expect(${name}, ${expected});`]);
    } else {
      throw new Error(
        `${where}: "// =>" needs an expression or a single \`const x = ...\` before it`,
      );
    }
  }
  let out = code;
  for (const [start, end, text] of edits.sort((a, b) => b[0] - a[0])) {
    out = out.slice(0, start) + text + out.slice(end);
  }
  return { code: out, assertions: edits.length };
}
