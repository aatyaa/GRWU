import { describe, expect, it } from 'vitest';
import {
  TERMS_VERSION,
  buildRecord,
  validAcceptance,
  watermarkText,
  type Acceptance,
} from '~/lib/access-record';

const acceptance: Acceptance = {
  name: 'Ada Lovelace',
  email: 'ada@example.org',
  version: TERMS_VERSION,
  at: '2026-10-21T09:00:00.000Z',
};

describe('the reading record', () => {
  it('names the code by its number, never the code itself', () => {
    const record = buildRecord({
      event: 'accepted-and-opened',
      codeId: '07',
      acceptance,
      termsSha256: 'abc',
      chapter: { slug: 'weighing-the-ring', title: 'Weighing the Ring' },
      page: 'https://example.org/GRWU/ringdown/weighing-the-ring/',
      now: new Date('2026-10-21T09:00:05.000Z'),
      timeZone: 'Africa/Cairo',
      userAgent: 'test',
      language: 'en',
    });
    expect(record.access_code_number).toBe('07');
    expect(record.event).toBe('Accepted the terms and opened a chapter');
    expect(record.chapter).toBe('Weighing the Ring (weighing-the-ring)');
    expect(record.name).toBe('Ada Lovelace');
    expect(record.email).toBe('ada@example.org');
    expect(record.time_utc).toBe('2026-10-21T09:00:05.000Z');
    expect(record.terms_version).toBe(TERMS_VERSION);
    expect(record.subject).toContain('code 07');
    expect(JSON.stringify(record)).not.toMatch(/RD-\d{2}-/);
  });

  it('asks for a full name and a real-looking email', () => {
    expect(validAcceptance('Ada Lovelace', 'ada@example.org')).toBe(true);
    expect(validAcceptance('Ada', 'ada@example.org')).toBe(false);
    expect(validAcceptance('Ada Lovelace', 'ada@example')).toBe(false);
  });

  it('puts the reader, the code number and the date on the watermark', () => {
    const text = watermarkText(acceptance, '07', new Date('2026-10-21T12:00:00Z'));
    expect(text).toContain('Ada Lovelace');
    expect(text).toContain('code 07');
    expect(text).toContain('2026-10-21');
  });
});
