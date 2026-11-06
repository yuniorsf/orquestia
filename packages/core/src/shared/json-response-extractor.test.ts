import { describe, expect, it } from 'vitest';
import { extractJsonObject } from './json-response-extractor.js';

describe('extractJsonObject', () => {
  it('returns a well-formed JSON object unchanged', () => {
    expect(extractJsonObject('{"a":1}')).toBe('{"a":1}');
  });

  it('strips a ```json markdown fence', () => {
    expect(extractJsonObject('```json\n{"a":1}\n```')).toBe('{"a":1}');
  });

  it('strips a plain ``` fence with no "json" label', () => {
    expect(extractJsonObject('```\n{"a":1}\n```')).toBe('{"a":1}');
  });

  it('extracts the object when the model wraps it in brace-free prose', () => {
    expect(extractJsonObject('Here you go:\n\n{"a":1}\n\nHope that helps!')).toBe('{"a":1}');
  });

  it('skips tool-call transcript noise with its own braces that precedes the real answer', () => {
    const stdout = [
      '$ Shell Read config 10 lines…',
      'cat config.ts && echo \'{ not: "json", just: "shell output" }\'',
      '{ not: "json", just: "shell output" }',
      '',
      '{"files":[{"path":"a.ts","content":"export const x = { nested: true };"}]}',
    ].join('\n');

    expect(extractJsonObject(stdout)).toBe(
      '{"files":[{"path":"a.ts","content":"export const x = { nested: true };"}]}',
    );
  });

  it('skips --help-style usage text with braces that precedes the real answer', () => {
    const stdout = [
      'Usage: agy [options] {prompt}',
      '  -p, --print {text}   run once and exit',
      '',
      '{"fileManifest":[],"codeSnippets":[]}',
    ].join('\n');

    expect(extractJsonObject(stdout)).toBe('{"fileManifest":[],"codeSnippets":[]}');
  });

  it('falls back to the first-to-last span when no candidate slice parses as JSON', () => {
    expect(extractJsonObject('{ this is not valid json at all }')).toBe(
      '{ this is not valid json at all }',
    );
  });

  it('returns the trimmed text unchanged when it has no braces at all', () => {
    expect(extractJsonObject('no json here')).toBe('no json here');
  });

  it('falls back to the first-to-last-brace span when there is a closing brace but no opening one', () => {
    expect(extractJsonObject('stray closing brace }')).toBe('stray closing brace }');
  });
});
