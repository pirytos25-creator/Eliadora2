// tests/import-export.test.js
import { describe, it, expect } from 'vitest';
import EliadoraPure from '../eliadora-pure.js';
const { extractEliadoraDataFromText, safeJsonForHtmlScript } = EliadoraPure;

describe('extractEliadoraDataFromText()', () => {
  it('wyciąga dane z pliku eliadora-data.js', () => {
    const text = `
      // komentarz
      window.ELIADORA_DATA = {
        familyName: "Testowa",
        defaultFocus: "x1",
        people: [{id:"x1",fn:"Jan",ln:"K",g:"M"}]
      };
    `;
    const result = extractEliadoraDataFromText(text);
    expect(result).not.toBeNull();
    expect(result.familyName).toBe('Testowa');
    expect(result.people).toHaveLength(1);
    expect(result.people[0].fn).toBe('Jan');
  });

  it('wyciąga dane osadzone w HTML (standalone export)', () => {
    const html = `<!DOCTYPE html>
<html><head>
<title>Test</title>
<script>
window.ELIADORA_DATA = {
  "familyName": "Kowalskich",
  "defaultFocus": "a",
  "people": [
    {"id": "a", "fn": "Jan", "ln": "K", "g": "M", "p": [], "s": ["b"]},
    {"id": "b", "fn": "Anna", "ln": "K", "g": "F", "p": [], "s": ["a"]}
  ]
};
</script>
</head><body>...</body></html>`;
    const result = extractEliadoraDataFromText(html);
    expect(result).not.toBeNull();
    expect(result.people).toHaveLength(2);
    expect(result.people[1].s).toEqual(['a']);
  });

  it('ogarnia trailing commas', () => {
    const text = `window.ELIADORA_DATA = {
      familyName: "X",
      people: [{id:"a",fn:"Jan",ln:"K",},],
    };`;
    const result = extractEliadoraDataFromText(text);
    expect(result).not.toBeNull();
    expect(result.people).toHaveLength(1);
  });

  it('zwraca null dla tekstu bez ELIADORA_DATA', () => {
    expect(extractEliadoraDataFromText('losowy tekst')).toBeNull();
    expect(extractEliadoraDataFromText('<html><body>nic</body></html>')).toBeNull();
  });

  it('zwraca null dla pustego stringa', () => {
    expect(extractEliadoraDataFromText('')).toBeNull();
  });

  it('zwraca null dla non-string', () => {
    expect(extractEliadoraDataFromText(null)).toBeNull();
    expect(extractEliadoraDataFromText(undefined)).toBeNull();
    expect(extractEliadoraDataFromText(42)).toBeNull();
  });

  it('ignoruje { } wewnątrz stringów', () => {
    const text = `window.ELIADORA_DATA = {
      familyName: "{niesensowna} nazwa { z nawiasami }",
      people: []
    };`;
    const result = extractEliadoraDataFromText(text);
    expect(result).not.toBeNull();
    expect(result.familyName).toBe('{niesensowna} nazwa { z nawiasami }');
  });

  it('ogarnia escaped quotes w stringach', () => {
    const text = `window.ELIADORA_DATA = {familyName:"O\\"Brien",people:[]};`;
    const result = extractEliadoraDataFromText(text);
    expect(result).not.toBeNull();
    expect(result.familyName).toBe('O"Brien');
  });

  it('ogarnia template literals (backtick)', () => {
    const text = "window.ELIADORA_DATA = {familyName:`X`, people:[]};";
    // Function eval to ogarnie, JSON.parse nie — sprawdzamy że fallback działa
    const result = extractEliadoraDataFromText(text);
    expect(result).not.toBeNull();
    expect(result.familyName).toBe('X');
  });

  it('bierze pierwsze wystąpienie ELIADORA_DATA gdy jest ich kilka', () => {
    const text = `
      window.ELIADORA_DATA = {familyName:"PIERWSZE", people:[]};
      // ELIADORA_DATA gdzieś w komentarzu
      window.ELIADORA_DATA = {familyName:"DRUGIE", people:[]};
    `;
    const result = extractEliadoraDataFromText(text);
    expect(result.familyName).toBe('PIERWSZE');
  });

  it('round-trip: stringify → extract daje to samo', () => {
    const original = {
      familyName: 'Test',
      defaultFocus: 'x1',
      people: [
        { id: 'x1', fn: 'Jan', ln: 'K', g: 'M', p: [], s: [] }
      ]
    };
    const serialized = 'window.ELIADORA_DATA = ' + JSON.stringify(original) + ';';
    const extracted = extractEliadoraDataFromText(serialized);
    expect(extracted).toEqual(original);
  });

  it('preferuje bezpieczny blok portable JSON z HTML', () => {
    const original = {
      familyName: 'Portable <Rodzina>',
      defaultFocus: 'x1',
      people: [
        { id: 'x1', fn: 'Jan', ln: 'K', g: 'M', image: 'data:image/png;base64,abc', p: [], s: [] }
      ],
      gallery: [
        { personId: 'x1', type: 'image', caption: 'A < B', dataURL: 'data:image/png;base64,def' }
      ]
    };
    const html = `
      <script>window.ELIADORA_DATA = {familyName:"STARE", people:[]};</script>
      <script id="eliadora-portable-data" type="application/json">${safeJsonForHtmlScript(original)}</script>
    `;
    const extracted = extractEliadoraDataFromText(html);
    expect(extracted).toEqual(original);
  });

  it('nie myli odczytu z porownaniem window.ELIADORA_DATA !== undefined', () => {
    const html = `
      <script>const loaded = typeof window.ELIADORA_DATA !== 'undefined'; const fallback = { people: [] };</script>
      <script>window.ELIADORA_DATA = {"familyName":"Wlasciwe","people":[{"id":"x1","p":[],"s":[]}]};</script>
    `;
    const extracted = extractEliadoraDataFromText(html);
    expect(extracted.familyName).toBe('Wlasciwe');
    expect(extracted.people).toHaveLength(1);
  });
});
