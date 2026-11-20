import { FormControl } from '@angular/forms';
import { Observable, of, throwError } from 'rxjs';
import { AliasCheck } from '../models/link.models';
import { aliasProblem } from './alias-rules';
import { aliasAvailableValidator, aliasFormatValidator } from './alias.validator';
import { httpUrlValidator } from './url.validator';

describe('alias rules', () => {
  it('accepts letters, digits, dashes and underscores', () => {
    for (const alias of ['abc', 'my-link', 'Launch_2026', 'a1b']) {
      expect(aliasProblem(alias)).toBeNull();
    }
  });

  it('rejects bad length, characters and reserved words', () => {
    expect(aliasProblem('ab')).toContain('at least 3');
    expect(aliasProblem('x'.repeat(33))).toContain('at most 32');
    expect(aliasProblem('has space')).toContain('letters, numbers');
    expect(aliasProblem('-start')).toContain('letters, numbers');
    expect(aliasProblem('ümlaut')).toContain('letters, numbers');
    expect(aliasProblem('API')).toBe('This word is reserved');
  });

  it('only validates the format when there is a value', () => {
    expect(aliasFormatValidator(new FormControl(''))).toBeNull();
    expect(aliasFormatValidator(new FormControl('a b'))).toEqual({
      alias: expect.stringContaining('letters'),
    });
  });
});

describe('aliasAvailableValidator', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function setup(answer: (alias: string) => Observable<AliasCheck>) {
    const calls: string[] = [];
    const validator = aliasAvailableValidator((alias) => {
      calls.push(alias);
      return answer(alias);
    }, 300);
    const control = new FormControl('', { asyncValidators: validator });
    return { control, calls };
  }

  it('waits for typing to pause and checks only the last value', () => {
    const { control, calls } = setup((alias) => of({ alias, available: true, reason: null }));
    control.setValue('lau');
    vi.advanceTimersByTime(100);
    control.setValue('launch');
    expect(control.pending).toBe(true);
    vi.advanceTimersByTime(300);
    expect(calls).toEqual(['launch']);
    expect(control.valid).toBe(true);
  });

  it('reports the reason when the alias is taken', () => {
    const { control } = setup((alias) => of({ alias, available: false, reason: 'Already taken' }));
    control.setValue('promo');
    vi.advanceTimersByTime(300);
    expect(control.errors).toEqual({ aliasTaken: 'Already taken' });
  });

  it('skips empty values and ignores failed checks', () => {
    const { control, calls } = setup(() => throwError(() => new Error('offline')));
    control.setValue('');
    expect(control.valid).toBe(true);
    control.setValue('offline-test');
    vi.advanceTimersByTime(300);
    expect(calls).toEqual(['offline-test']);
    expect(control.valid).toBe(true);
  });
});

describe('httpUrlValidator', () => {
  const check = (value: string) => httpUrlValidator(new FormControl(value));

  it('accepts http and https URLs', () => {
    expect(check('https://example.com/a?b=c')).toBeNull();
    expect(check('http://localhost:4200/x')).toBeNull();
    expect(check('')).toBeNull();
  });

  it('rejects other schemes and broken URLs', () => {
    expect(check('ftp://example.com')).toEqual({ url: 'URL must start with http:// or https://' });
    expect(check('example.com')).toEqual({ url: 'URL must start with http:// or https://' });
    expect(check('https://nodot')).toEqual({ url: 'Enter a valid URL' });
    expect(check('https://exa mple.com')).toEqual({ url: 'Enter a valid URL' });
  });
});
