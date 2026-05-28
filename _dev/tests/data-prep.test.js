// tests/data-prep.test.js
import { describe, it, expect } from 'vitest';
import EliadoraPure from '../eliadora-pure.js';
const { normalizePeople, buildSavable } = EliadoraPure;

describe('normalizePeople()', () => {
  it('dodaje brakujące p[] i s[] do osób', () => {
    const people = [
      { id: 'a', fn: 'Jan', ln: 'K' },
      { id: 'b', fn: 'Anna', ln: 'K', p: ['a'] }
    ];
    const changed = normalizePeople(people);
    expect(changed).toBe(true);
    expect(people[0].p).toEqual([]);
    expect(people[0].s).toEqual([]);
    expect(people[1].p).toEqual(['a']);
    expect(people[1].s).toEqual([]);
  });

  it('zwraca false jeśli nic nie trzeba było naprawić', () => {
    const people = [{ id: 'a', fn: 'Jan', ln: 'K', p: [], s: [] }];
    expect(normalizePeople(people)).toBe(false);
  });

  it('odporne na non-array input', () => {
    expect(normalizePeople(null)).toBe(false);
    expect(normalizePeople(undefined)).toBe(false);
    expect(normalizePeople('foo')).toBe(false);
  });

  it('naprawia jak p lub s jest nie-tablicą', () => {
    const people = [{ id: 'a', fn: 'Jan', ln: 'K', p: 'invalid', s: null }];
    normalizePeople(people);
    expect(Array.isArray(people[0].p)).toBe(true);
    expect(Array.isArray(people[0].s)).toBe(true);
  });
});

describe('buildSavable()', () => {
  it('zwraca kopię — nie modyfikuje oryginału', () => {
    const original = [{ id: 'a', fn: 'Jan', ln: 'K', p: ['x'], s: ['y'] }];
    const saved = buildSavable(original);
    saved[0].fn = 'CHANGED';
    saved[0].p.push('z');
    expect(original[0].fn).toBe('Jan');
    expect(original[0].p).toEqual(['x']);
  });

  it('zachowuje data: URL z pola image', () => {
    const people = [{
      id: 'a', fn: 'Jan', ln: 'K',
      image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='
    }];
    const saved = buildSavable(people);
    expect(saved[0].image).toBe(people[0].image);
  });

  it('zachowuje ścieżkę względną do zdjęcia', () => {
    const people = [{ id: 'a', fn: 'Jan', ln: 'K', image: 'p/jan.png' }];
    const saved = buildSavable(people);
    expect(saved[0].image).toBe('p/jan.png');
  });

  it('stripuje data: URL z video, gif, portraitMP4', () => {
    const people = [{
      id: 'a', fn: 'Jan', ln: 'K',
      gif: 'data:image/gif;base64,xxx',
      video: 'data:video/mp4;base64,yyy',
      portraitMP4: 'data:video/webm;base64,zzz'
    }];
    const saved = buildSavable(people);
    expect(saved[0].gif).toBe('');
    expect(saved[0].video).toBe('');
    expect(saved[0].portraitMP4).toBe('');
  });

  it('klonuje obiekt bio (deep enough)', () => {
    const people = [{ id: 'a', fn: 'Jan', ln: 'K', bio: { pl: 'tekst', en: 'text' } }];
    const saved = buildSavable(people);
    saved[0].bio.pl = 'CHANGED';
    expect(people[0].bio.pl).toBe('tekst');
  });

  it('odporne na non-array input', () => {
    expect(buildSavable(null)).toEqual([]);
    expect(buildSavable(undefined)).toEqual([]);
    expect(buildSavable('foo')).toEqual([]);
  });

  it('zachowuje tablicę nat[]', () => {
    const people = [{ id: 'a', fn: 'Jan', ln: 'K', nat: ['PL', 'UA'] }];
    const saved = buildSavable(people);
    expect(saved[0].nat).toEqual(['PL', 'UA']);
    saved[0].nat.push('DE');
    expect(people[0].nat).toEqual(['PL', 'UA']);
  });
});
