// tests/genealogy.test.js
import { describe, it, expect } from 'vitest';
import EliadoraPure from '../eliadora-pure.js';
const { isAncestor, applyParentLink, findDuplicate, ageSanityWarning } = EliadoraPure;

// Helper — buduje pmap z listy osób
function makeMap(people) {
  return Object.fromEntries(people.map(p => [p.id, p]));
}

// Helper — typowa rodzina 3-pokoleniowa do testów
//
//   dziadek ──┬── babcia
//             │
//           ojciec ──┬── matka
//                    │
//                  dziecko
//
function familyOf3() {
  const people = [
    { id: 'dziadek', fn: 'Karol', ln: 'K', g: 'M', b: '1920', p: [], s: ['babcia'] },
    { id: 'babcia',  fn: 'Maria', ln: 'K', g: 'F', b: '1925', p: [], s: ['dziadek'] },
    { id: 'ojciec',  fn: 'Jan',   ln: 'K', g: 'M', b: '1950', p: ['dziadek','babcia'], s: ['matka'] },
    { id: 'matka',   fn: 'Anna',  ln: 'N', g: 'F', b: '1955', p: [], s: ['ojciec'] },
    { id: 'dziecko', fn: 'Piotr', ln: 'K', g: 'M', b: '1980', p: ['ojciec','matka'], s: [] }
  ];
  return { people, pmap: makeMap(people) };
}

describe('isAncestor()', () => {
  it('zwraca true gdy osoba jest dosłownie sobą (degenerat)', () => {
    const { pmap } = familyOf3();
    expect(isAncestor('dziadek', 'dziadek', pmap)).toBe(true);
  });

  it('wykrywa bezpośredniego rodzica jako przodka', () => {
    const { pmap } = familyOf3();
    expect(isAncestor('ojciec', 'dziecko', pmap)).toBe(true);
    expect(isAncestor('matka',  'dziecko', pmap)).toBe(true);
  });

  it('wykrywa dziadka jako przodka wnuka', () => {
    const { pmap } = familyOf3();
    expect(isAncestor('dziadek', 'dziecko', pmap)).toBe(true);
    expect(isAncestor('babcia',  'dziecko', pmap)).toBe(true);
  });

  it('zwraca false jeśli osoba NIE jest przodkiem', () => {
    const { pmap } = familyOf3();
    // Dziecko nie jest przodkiem dziadka
    expect(isAncestor('dziecko', 'dziadek', pmap)).toBe(false);
    // Małżonek nie jest przodkiem
    expect(isAncestor('babcia', 'dziadek', pmap)).toBe(false);
  });

  it('nie wpada w pętlę nieskończoną przy okrężnych referencjach', () => {
    // Patologiczne dane: A → B → A
    const people = [
      { id: 'a', g: 'M', p: ['b'] },
      { id: 'b', g: 'F', p: ['a'] }
    ];
    const pmap = makeMap(people);
    // Nie wywala się — zwraca true (a jest przodkiem b? tak, przez pętlę)
    // ale ważne: kończy się w skończonym czasie
    const start = Date.now();
    isAncestor('a', 'b', pmap);
    expect(Date.now() - start).toBeLessThan(100);
  });

  it('odporne na nieistniejące ID', () => {
    const { pmap } = familyOf3();
    expect(isAncestor('nieistnieje', 'dziecko', pmap)).toBe(false);
    expect(isAncestor('dziadek', 'nieistnieje', pmap)).toBe(false);
  });

  it('null pmap nie wywala', () => {
    expect(isAncestor('a', 'b', null)).toBe(false);
    expect(isAncestor('a', 'b', undefined)).toBe(false);
  });
});

describe('applyParentLink()', () => {
  it('przypisuje ojca do pustego dziecka', () => {
    const child = { id: 'c', p: [] };
    const pmap = { c: child, 'tata': { id: 'tata', g: 'M' } };
    const result = applyParentLink(child, 'tata', 'M', pmap);
    expect(result).toBe('ok');
    expect(child.p).toEqual(['tata']);
  });

  it('przypisuje matkę gdy ojciec już jest — kolejność: ojciec, matka', () => {
    const child = { id: 'c', p: ['tata'] };
    const pmap = {
      c: child,
      'tata': { id: 'tata', g: 'M' },
      'mama': { id: 'mama', g: 'F' }
    };
    const result = applyParentLink(child, 'mama', 'F', pmap);
    expect(result).toBe('ok');
    expect(child.p).toEqual(['tata', 'mama']);
  });

  it('odrzuca drugiego ojca gdy ojciec już jest', () => {
    const child = { id: 'c', p: ['tata'] };
    const pmap = {
      c: child,
      'tata': { id: 'tata', g: 'M' },
      'tata2': { id: 'tata2', g: 'M' }
    };
    const result = applyParentLink(child, 'tata2', 'M', pmap);
    expect(result).toBe('filled');
    expect(child.p).toEqual(['tata']); // niezmienione
  });

  it('ignoruje nieistniejące ID rodzica (stale ID)', () => {
    // Dziecko ma "rodzica" który już nie istnieje w pmap — slot wolny
    const child = { id: 'c', p: ['martwy_id'] };
    const pmap = {
      c: child,
      'tata': { id: 'tata', g: 'M' }
      // 'martwy_id' celowo brak
    };
    const result = applyParentLink(child, 'tata', 'M', pmap);
    expect(result).toBe('ok');
    expect(child.p).toEqual(['tata']);
  });

  it('odporne na childPerson = null', () => {
    expect(applyParentLink(null, 'x', 'M', {})).toBe('filled');
  });

  it('odporne na brak p[] w dziecku', () => {
    const child = { id: 'c' }; // bez p
    const pmap = { c: child, 'tata': { id: 'tata', g: 'M' } };
    const result = applyParentLink(child, 'tata', 'M', pmap);
    expect(result).toBe('ok');
    expect(child.p).toEqual(['tata']);
  });
});

describe('findDuplicate()', () => {
  const people = [
    { id: '1', fn: 'Jan',  ln: 'Kowalski', b: '1900' },
    { id: '2', fn: 'Anna', ln: 'Kowalska', b: '1905' },
    { id: '3', fn: 'Jan',  ln: 'Kowalski', b: '1950' },
    { id: '4', fn: 'Piotr', ln: 'Nowak' /* brak b */ }
  ];

  it('znajduje duplikat po fn+ln+roku', () => {
    const dup = findDuplicate('Jan', 'Kowalski', '1900', null, people);
    expect(dup?.id).toBe('1');
  });

  it('case-insensitive', () => {
    const dup = findDuplicate('JAN', 'kowalski', '1900', null, people);
    expect(dup?.id).toBe('1');
  });

  it('rozróżnia po roku urodzenia', () => {
    const dup = findDuplicate('Jan', 'Kowalski', '1950', null, people);
    expect(dup?.id).toBe('3');
  });

  it('pomija osobę z excludeId', () => {
    const dup = findDuplicate('Jan', 'Kowalski', '1900', '1', people);
    expect(dup).toBeNull();
  });

  it('zwraca null gdy nie ma dopasowania', () => {
    expect(findDuplicate('Zenon', 'Nieznany', '2000', null, people)).toBeNull();
  });

  it('matchuje gdy podany rok jest pusty (sam fn+ln)', () => {
    const dup = findDuplicate('Jan', 'Kowalski', '', null, people);
    expect(dup).not.toBeNull();
    expect(['1', '3']).toContain(dup.id);
  });

  it('matchuje osobę bez roku gdy szukamy z rokiem', () => {
    const dup = findDuplicate('Piotr', 'Nowak', '1970', null, people);
    expect(dup?.id).toBe('4');
  });

  it('parsuje rok ze stringa "1900-01-15"', () => {
    const dup = findDuplicate('Jan', 'Kowalski', '1900-01-15', null, people);
    expect(dup?.id).toBe('1');
  });

  it('odporne na non-array people', () => {
    expect(findDuplicate('Jan', 'K', '1900', null, null)).toBeNull();
  });

  it('odporne na non-string fn/ln', () => {
    expect(findDuplicate(null, 'K', '1900', null, people)).toBeNull();
    expect(findDuplicate('Jan', undefined, '1900', null, people)).toBeNull();
  });
});

describe('ageSanityWarning()', () => {
  it('zwraca null dla sensownych dat', () => {
    const person = { fn: 'Jan', ln: 'K', b: '1950', d: '2020' };
    expect(ageSanityWarning(person, [], {})).toBeNull();
  });

  it('zwraca null gdy brak dat', () => {
    const person = { fn: 'Jan', ln: 'K' };
    expect(ageSanityWarning(person, [], {})).toBeNull();
  });

  it('ostrzega gdy zgon przed urodzeniem', () => {
    const person = { fn: 'Jan', ln: 'K', b: '2000', d: '1990' };
    const warn = ageSanityWarning(person, [], {});
    expect(warn).toContain('1990');
    expect(warn).toContain('2000');
  });

  it('ostrzega gdy rodzic urodzony PO dziecku', () => {
    const person = { fn: 'Dziecko', ln: 'K', b: '1950' };
    const pmap = {
      'tata': { fn: 'Tata', ln: 'K', b: '1960' } // o 10 lat młodszy od dziecka!
    };
    const warn = ageSanityWarning(person, ['tata'], pmap);
    expect(warn).toContain('Tata');
    expect(warn).toContain('1960');
    expect(warn).toContain('1950');
  });

  it('ostrzega gdy rodzic urodzony W TYM SAMYM roku co dziecko', () => {
    const person = { fn: 'X', ln: 'Y', b: '1980' };
    const pmap = { 'p1': { fn: 'P', ln: 'Y', b: '1980' } };
    const warn = ageSanityWarning(person, ['p1'], pmap);
    expect(warn).not.toBeNull();
  });

  it('ignoruje rodzica który nie istnieje w pmap', () => {
    const person = { fn: 'X', ln: 'Y', b: '1980' };
    expect(ageSanityWarning(person, ['nieistnieje'], {})).toBeNull();
  });

  it('akumuluje wiele ostrzeżeń', () => {
    const person = { fn: 'X', ln: 'Y', b: '1980', d: '1970' }; // zgon przed urodzeniem
    const pmap = { 'p1': { fn: 'P', ln: 'Y', b: '1985' } };    // rodzic młodszy
    const warn = ageSanityWarning(person, ['p1'], pmap);
    expect(warn.split('\n').length).toBe(2);
  });

  it('odporne na person = null', () => {
    expect(ageSanityWarning(null, [], {})).toBeNull();
  });
});
