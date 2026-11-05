import { getError } from './get-error.util';

describe('getError', () => {
  it('returns a plain string message as written', () => {
    expect(getError('Pick at most 6 featured projects')).toBe('Pick at most 6 featured projects');
  });

  it('falls back for an empty string, null and an unknown value', () => {
    expect(getError('  ')).toBe('Something went wrong');
    expect(getError(null, 'Save failed')).toBe('Save failed');
    expect(getError({}, 'Save failed')).toBe('Save failed');
  });

  it('prefers field errors, then the API message, from an HttpErrorResponse-like object', () => {
    const withFields = { error: { message: 'Validation failed', errors: [{ field: 'a', message: 'A is required' }, { message: 'B is too long' }] } };
    expect(getError(withFields)).toBe('A is required, B is too long');
    expect(getError({ error: { message: 'Not found' } })).toBe('Not found');
  });
});
