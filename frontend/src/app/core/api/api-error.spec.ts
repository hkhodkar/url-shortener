import { HttpErrorResponse } from '@angular/common/http';
import { apiErrorMessage } from './api-error';

describe('apiErrorMessage', () => {
  it('uses a plain detail string', () => {
    const error = new HttpErrorResponse({ status: 409, error: { detail: 'Alias taken' } });
    expect(apiErrorMessage(error)).toBe('Alias taken');
  });

  it('joins FastAPI validation messages without the pydantic prefix', () => {
    const error = new HttpErrorResponse({
      status: 422,
      error: { detail: [{ loc: ['body', 'alias'], msg: 'Value error, This word is reserved' }] },
    });
    expect(apiErrorMessage(error)).toBe('This word is reserved');
  });

  it('explains network errors and falls back otherwise', () => {
    expect(apiErrorMessage(new HttpErrorResponse({ status: 0 }))).toContain('Could not reach');
    expect(apiErrorMessage(new Error('x'), 'Nope')).toBe('Nope');
  });
});
