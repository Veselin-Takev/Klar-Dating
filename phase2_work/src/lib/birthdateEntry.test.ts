import { describe, expect, it } from 'vitest';
import { birthdateFromParts, partsFromBirthdate } from './birthdateEntry';

describe('accessible mobile birthdate entry', () => {
  it('constructs a canonical ISO date from day/month/year without changing the server age rule', () => {
    expect(birthdateFromParts('10', '11', '2000')).toBe('2000-11-10');
    expect(birthdateFromParts('9', '2', '2008')).toBe('2008-02-09');
    // A date for a minor is syntactically valid: ONLY the server can decide
    // underage lock or adult eligibility.
    expect(birthdateFromParts('1', '1', '2020')).toBe('2020-01-01');
  });

  it('accepts leap years and refuses impossible Gregorian dates', () => {
    expect(birthdateFromParts('29', '02', '2000')).toBe('2000-02-29');
    expect(birthdateFromParts('29', '02', '1900')).toBeNull();
    expect(birthdateFromParts('29', '02', '2025')).toBeNull();
    expect(birthdateFromParts('31', '4', '2000')).toBeNull();
    expect(birthdateFromParts('0', '01', '2000')).toBeNull();
    expect(birthdateFromParts('30', '13', '2000')).toBeNull();
  });

  it('rejects incomplete, implausible and nonnumeric entry before contacting the API', () => {
    expect(birthdateFromParts('', '11', '2000')).toBeNull();
    expect(birthdateFromParts('10', '', '2000')).toBeNull();
    expect(birthdateFromParts('10', '11', '20')).toBeNull();
    expect(birthdateFromParts('10', '11', '1899')).toBeNull();
    expect(birthdateFromParts('AA', '11', '2000')).toBeNull();
    expect(birthdateFromParts('10', '11', '2O00')).toBeNull();
  });

  it('roundtrips the calendar and direct entry modes without shifting time zones', () => {
    expect(partsFromBirthdate('2000-11-10')).toEqual({
      day: '10', month: '11', year: '2000',
    });
    expect(partsFromBirthdate('2008-02-09')).toEqual({
      day: '9', month: '02', year: '2008',
    });
    expect(partsFromBirthdate('2000-02-30')).toBeNull();
    expect(partsFromBirthdate('2000/11/10')).toBeNull();
  });
});
