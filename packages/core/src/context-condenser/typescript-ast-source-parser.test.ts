import { describe, expect, it } from 'vitest';
import { TypeScriptAstSourceParser } from './typescript-ast-source-parser.js';

const parser = new TypeScriptAstSourceParser();

function signaturesFor(sourceText: string): string[] {
  return parser.parseFile('test.ts', sourceText).declarations.map((d) => d.signature);
}

describe('TypeScriptAstSourceParser.parseFile', () => {
  it('ignores non-exported declarations entirely', () => {
    const parsed = parser.parseFile('test.ts', 'function internal(): void {}\nconst x = 1;');

    expect(parsed.declarations).toEqual([]);
  });

  it('ignores a top-level statement that cannot carry modifiers at all', () => {
    const parsed = parser.parseFile('test.ts', 'console.log("side effect");');

    expect(parsed.declarations).toEqual([]);
  });

  it('ignores an exported declaration kind this condenser does not model (e.g. a namespace)', () => {
    const parsed = parser.parseFile('test.ts', 'export namespace Foo {}');

    expect(parsed.declarations).toEqual([]);
  });

  it('keeps an exported interface as-is (nothing to strip)', () => {
    const [signature] = signaturesFor('export interface Foo {\n  readonly x: number;\n}');

    expect(signature).toBe('export interface Foo {\n    readonly x: number;\n}');
  });

  it('keeps an exported type alias as-is', () => {
    const [signature] = signaturesFor('export type Status = "active" | "inactive";');

    expect(signature).toBe('export type Status = "active" | "inactive";');
  });

  it('keeps an exported enum as-is', () => {
    const [signature] = signaturesFor('export enum Color {\n  Red,\n  Blue,\n}');

    expect(signature).toContain('export enum Color');
    expect(signature).toContain('Red');
  });

  it('strips an exported function body down to its signature', () => {
    const [signature] = signaturesFor(
      'export function add(a: number, b: number): number {\n  return a + b;\n}',
    );

    expect(signature).toBe('export function add(a: number, b: number): number;');
  });

  it('strips a typed const initializer but keeps an untyped one (no other clue to the type)', () => {
    const [typed, untyped] = signaturesFor(
      'export const MAX: number = 42;\nexport const DEFAULTS = ["a", "b"];',
    );

    expect(typed).toBe('export const MAX: number;');
    expect(untyped).toContain('export const DEFAULTS = ["a", "b"]');
  });

  it('splits a multi-declaration export const statement into one self-contained signature per name', () => {
    const [a, b] = signaturesFor('export const A: number = 1, B: string = "x";');

    expect(a).toBe('export const A: number;');
    expect(b).toBe('export const B: string;');
  });

  it('removes private class members entirely, strips bodies of the rest, and keeps the constructor signature', () => {
    const [signature] = signaturesFor(
      [
        'export class Widget {',
        '  private secret: string = "hidden";',
        '  readonly label: string;',
        '',
        '  constructor(private readonly dep: string, label: string) {',
        '    this.label = label;',
        '  }',
        '',
        '  private helper(): void {',
        '    console.log("hidden");',
        '  }',
        '',
        '  compute(a: number, b: number): number {',
        '    return a + b;',
        '  }',
        '}',
      ].join('\n'),
    );

    expect(signature).not.toContain('secret');
    expect(signature).not.toContain('helper');
    expect(signature).not.toContain('hidden');
    expect(signature).toContain('readonly label: string;');
    expect(signature).toContain('constructor(private readonly dep: string, label: string);');
    expect(signature).toContain('compute(a: number, b: number): number;');
    expect(signature).not.toContain('return a + b');
  });

  it('strips getter/setter accessor bodies while keeping their signatures', () => {
    const [signature] = signaturesFor(
      [
        'export class Box {',
        '  get value(): number {',
        '    return 1;',
        '  }',
        '  set value(v: number) {',
        '    this._v = v;',
        '  }',
        '}',
      ].join('\n'),
    );

    expect(signature).toContain('get value(): number;');
    expect(signature).toContain('set value(v: number);');
    expect(signature).not.toContain('return 1');
  });

  it('strips JSDoc and inline comments from every kind of signature', () => {
    const [signature] = signaturesFor(
      [
        '/** Adds two numbers. */',
        'export function add(a: number, b: number): number {',
        '  // sum',
        '  return a + b;',
        '}',
      ].join('\n'),
    );

    expect(signature).not.toContain('Adds two numbers');
    expect(signature).not.toContain('// sum');
  });

  it('removes a class entirely stripped of members if it has none to keep', () => {
    const [signature] = signaturesFor('export class Empty {\n  private onlyPrivate(): void {}\n}');

    expect(signature).toBe('export class Empty {\n}');
  });

  it('keeps a class member that cannot carry modifiers (e.g. a static block) as-is, unstripped', () => {
    const [signature] = signaturesFor(
      ['export class Foo {', '  static { console.log(1); }', '}'].join('\n'),
    );

    expect(signature).toContain('static { console.log(1); }');
  });
});
