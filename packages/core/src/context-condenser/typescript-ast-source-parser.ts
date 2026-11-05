import ts from 'typescript';
import type {
  DeclarationKind,
  ExportedDeclaration,
  ParsedFile,
  SourceParserPort,
} from './types.js';

const printer = ts.createPrinter({ removeComments: true });

/**
 * Real `SourceParserPort` adapter for TypeScript/JavaScript, using the
 * `typescript` compiler API's own AST (already a project dependency —
 * no new parser dependency needed). Operates purely syntactically on
 * each file in isolation (no cross-file type resolution), which keeps
 * it deterministic and avoids requiring a full program/module graph
 * just to summarize a peripheral file.
 */
export class TypeScriptAstSourceParser implements SourceParserPort {
  parseFile(filePath: string, sourceText: string): ParsedFile {
    const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true);
    const declarations: ExportedDeclaration[] = [];

    for (const statement of sourceFile.statements) {
      if (!isExported(statement)) {
        continue;
      }
      declarations.push(...declarationsFor(statement, sourceFile));
    }

    return { filePath, declarations };
  }
}

function declarationsFor(
  statement: ts.Statement,
  sourceFile: ts.SourceFile,
): ExportedDeclaration[] {
  if (ts.isInterfaceDeclaration(statement)) {
    return [render('interface', statement.name.text, statement, sourceFile)];
  }
  if (ts.isTypeAliasDeclaration(statement)) {
    return [render('type', statement.name.text, statement, sourceFile)];
  }
  if (ts.isEnumDeclaration(statement)) {
    return [render('enum', statement.name.text, statement, sourceFile)];
  }
  if (ts.isClassDeclaration(statement) && statement.name) {
    return [render('class', statement.name.text, stripClassBody(statement), sourceFile)];
  }
  if (ts.isFunctionDeclaration(statement) && statement.name) {
    return [render('function', statement.name.text, stripFunctionBody(statement), sourceFile)];
  }
  if (ts.isVariableStatement(statement)) {
    return statement.declarationList.declarations
      .filter((declaration) => ts.isIdentifier(declaration.name))
      .map((declaration) =>
        render(
          'const',
          (declaration.name as ts.Identifier).text,
          singleDeclarationStatement(statement, stripVariableInitializer(declaration)),
          sourceFile,
        ),
      );
  }
  return [];
}

/** Rebuilds a full `export const NAME: Type;` statement around one declaration, so the printed signature is self-contained (not a bare, wrapper-less fragment) even when the original statement declared several names together. */
function singleDeclarationStatement(
  original: ts.VariableStatement,
  declaration: ts.VariableDeclaration,
): ts.VariableStatement {
  return ts.factory.updateVariableStatement(
    original,
    original.modifiers,
    ts.factory.createVariableDeclarationList([declaration], original.declarationList.flags),
  );
}

function render(
  kind: DeclarationKind,
  name: string,
  node: ts.Node,
  sourceFile: ts.SourceFile,
): ExportedDeclaration {
  return { kind, name, signature: printer.printNode(ts.EmitHint.Unspecified, node, sourceFile) };
}

function isExported(statement: ts.Statement): boolean {
  if (!ts.canHaveModifiers(statement)) {
    return false;
  }
  return (ts.getModifiers(statement) ?? []).some(
    (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
  );
}

function isPrivate(member: ts.ClassElement): boolean {
  if (!ts.canHaveModifiers(member)) {
    return false;
  }
  return (ts.getModifiers(member) ?? []).some(
    (modifier) => modifier.kind === ts.SyntaxKind.PrivateKeyword,
  );
}

/** Drops private members entirely; strips the body of every remaining method/constructor/accessor and the initializer of every remaining property. */
function stripClassBody(node: ts.ClassDeclaration): ts.ClassDeclaration {
  const keptMembers = node.members
    .filter((member) => !isPrivate(member))
    .map((member) => stripMemberBody(member));
  return ts.factory.updateClassDeclaration(
    node,
    node.modifiers,
    node.name,
    node.typeParameters,
    node.heritageClauses,
    keptMembers,
  );
}

function stripMemberBody(member: ts.ClassElement): ts.ClassElement {
  if (ts.isMethodDeclaration(member)) {
    return ts.factory.updateMethodDeclaration(
      member,
      member.modifiers,
      member.asteriskToken,
      member.name,
      member.questionToken,
      member.typeParameters,
      member.parameters,
      member.type,
      undefined,
    );
  }
  if (ts.isConstructorDeclaration(member)) {
    return ts.factory.updateConstructorDeclaration(
      member,
      member.modifiers,
      member.parameters,
      undefined,
    );
  }
  if (ts.isGetAccessorDeclaration(member)) {
    return ts.factory.updateGetAccessorDeclaration(
      member,
      member.modifiers,
      member.name,
      member.parameters,
      member.type,
      undefined,
    );
  }
  if (ts.isSetAccessorDeclaration(member)) {
    return ts.factory.updateSetAccessorDeclaration(
      member,
      member.modifiers,
      member.name,
      member.parameters,
      undefined,
    );
  }
  if (ts.isPropertyDeclaration(member)) {
    return ts.factory.updatePropertyDeclaration(
      member,
      member.modifiers,
      member.name,
      member.questionToken,
      member.type,
      undefined,
    );
  }
  return member;
}

function stripFunctionBody(node: ts.FunctionDeclaration): ts.FunctionDeclaration {
  return ts.factory.updateFunctionDeclaration(
    node,
    node.modifiers,
    node.asteriskToken,
    node.name,
    node.typeParameters,
    node.parameters,
    node.type,
    undefined,
  );
}

/** Strips the initializer only when an explicit type annotation makes that safe (otherwise the value is the only clue to the type, so it's kept). */
function stripVariableInitializer(declaration: ts.VariableDeclaration): ts.VariableDeclaration {
  if (!declaration.type) {
    return declaration;
  }
  return ts.factory.updateVariableDeclaration(
    declaration,
    declaration.name,
    declaration.exclamationToken,
    declaration.type,
    undefined,
  );
}
