// tests/escape.test.js
import { describe, it, expect } from 'vitest';
import EliadoraPure from '../eliadora-pure.js';
const { esc, escAttr } = EliadoraPure;

describe('esc() — escape dla HTML text content', () => {
  it('escapuje znaki specjalne HTML', () => {
    expect(esc('<script>')).toBe('&lt;script&gt;');
    expect(esc('"quoted"')).toBe('&quot;quoted&quot;');
    expect(esc("'apos'")).toBe('&#39;apos&#39;');
    expect(esc('a & b')).toBe('a &amp; b');
  });

  it('zwraca normalne znaki bez zmian', () => {
    expect(esc('Jan Kowalski')).toBe('Jan Kowalski');
    expect(esc('1900-01-15')).toBe('1900-01-15');
    expect(esc('Kraków')).toBe('Kraków');
  });

  it('konwertuje non-string na string', () => {
    expect(esc(42)).toBe('42');
    expect(esc(null)).toBe('null');
    expect(esc(undefined)).toBe('undefined');
  });

  it('neutralizuje pełny payload XSS', () => {
    const payload = '<img src=x onerror="alert(1)">';
    const result = esc(payload);
    // Po escape — nie ma już żadnych "ostrych" znaków, więc HTML parser
    // zobaczy zwykły tekst, nie tag.
    expect(result).not.toContain('<');
    expect(result).not.toContain('>');
    expect(result).not.toContain('"');
    // Ale za to ma encoded wersje
    expect(result).toContain('&lt;img');
    expect(result).toContain('&quot;');
  });
});

describe('escAttr() — escape dla wartości w onclick="foo(\'...\')"', () => {
  it('escapuje apostrof żeby nie wyjść z literału JS', () => {
    expect(escAttr("O'Brien")).toBe("O\\'Brien");
  });

  it('escapuje XSS injection próbujący zamknąć string', () => {
    const malicious = "');alert(1);//";
    const result = escAttr(malicious);
    // Po escAttr apostrof jest poprzedzony backslashem
    expect(result).toBe("\\&#39;);alert(1);//".replace('&#39;', "'"));
    // Bardziej praktyczny test: czy zawiera niezescapowany ' ?
    // (apostrofy są zamienione na \')
    const unescapedApos = result.replace(/\\'/g, '');
    expect(unescapedApos).not.toContain("'");
  });

  it('escapuje backslash przed apostrofem (kolejność ma znaczenie)', () => {
    expect(escAttr("a\\b")).toBe('a\\\\b');
    expect(escAttr("a\\'b")).toBe("a\\\\\\'b");
  });

  it('escapuje newline', () => {
    expect(escAttr('a\nb')).toBe('a\\nb');
    expect(escAttr('a\r\nb')).toBe('a\\nb');
  });

  it('HTML-encoduje & i " ale nie \'', () => {
    expect(escAttr('a&b')).toBe('a&amp;b');
    expect(escAttr('a"b')).toBe('a&quot;b');
  });

  it('escapuje znaki HTML < > w obronie głębokościowej', () => {
    expect(escAttr('<div>')).toBe('&lt;div&gt;');
  });

  it('przepuszcza normalne ID', () => {
    expect(escAttr('person_123')).toBe('person_123');
    expect(escAttr('diy_start')).toBe('diy_start');
  });

  it('przykład z prawdziwego CHANGELOG-FIXES — neutralizuje payload', () => {
    // Z CHANGELOG: id: "');alert(1);//"
    const id = "');alert(1);//";
    const escaped = escAttr(id);
    // Po wstawieniu w onclick="foo('${escaped}')" — apostrof jest zescapowany,
    // więc payload nie wyjdzie z literału JS.
    expect(escaped.indexOf("\\'")).toBeGreaterThanOrEqual(0);
  });
});
