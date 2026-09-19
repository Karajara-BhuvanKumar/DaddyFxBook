import { describe, it, expect } from 'vitest';
import { isSchemaMismatchError } from '@/lib/supabaseErrors';

describe('isSchemaMismatchError', () => {
  it('detects PGRST204 code', () => {
    expect(isSchemaMismatchError({ code: 'PGRST204', message: 'Could not find the column' })).toBe(true);
  });

  it('detects PGRST205 code', () => {
    expect(isSchemaMismatchError({ code: 'pgrst205', message: 'Some error' })).toBe(true);
  });

  it('detects 42703 code', () => {
    expect(isSchemaMismatchError({ code: '42703', message: 'column does not exist' })).toBe(true);
  });

  it('detects 42P01 code', () => {
    expect(isSchemaMismatchError({ code: '42P01', message: 'relation does not exist' })).toBe(true);
  });

  it('detects message with schema cache', () => {
    expect(isSchemaMismatchError(new Error('Could not find the table in the schema cache'))).toBe(true);
  });

  it('detects message with does not exist', () => {
    expect(isSchemaMismatchError({ message: 'relation "public.rule_violations" does not exist' })).toBe(true);
  });

  it('detects message with could not find the', () => {
    expect(isSchemaMismatchError({ message: 'Could not find the rule_type column' })).toBe(true);
  });

  it('returns false for unrelated errors', () => {
    expect(isSchemaMismatchError({ code: '42501', message: 'new row violates row-level security policy' })).toBe(false);
    expect(isSchemaMismatchError({ code: '23505', message: 'duplicate key value violates unique constraint' })).toBe(false);
    expect(isSchemaMismatchError(new Error('Network error'))).toBe(false);
    expect(isSchemaMismatchError(null)).toBe(false);
    expect(isSchemaMismatchError(undefined)).toBe(false);
    expect(isSchemaMismatchError('just a string')).toBe(false);
  });
});
