/**
 * The reading record of the gated ringdown track (ADR 0011). Before a reader's first chapter
 * they accept the terms below in their own name, and that acceptance is reported once to the
 * author through the same form service as access requests, which emails the owner with its
 * own timestamp. Shared by the code box (CodeForm.astro) and its element (sealed.ts).
 */

export const AUTHOR = 'Attia A. Gadallah';

/** Change the version whenever the wording changes: records carry both. */
export const TERMS_VERSION = '2 (2026-10-21)';

export const TERMS: readonly string[] = [
  `This track presents unpublished research by ${AUTHOR}. The manuscript has not been submitted or published.`,
  'It is shared with you personally, for reading and for discussion with the author.',
  'You agree not to copy, share, publish or reuse its text, figures, methods, code or results, in whole or in part, without the written permission of the author.',
  'When you accept, your name, your email, the number of your access code, the chapter you open and the time are sent to the author as a record of your access to the whole track.',
];

/** What a reader agreed to, kept in their browser and repeated in every record. */
export interface Acceptance {
  name: string;
  email: string;
  version: string;
  /** ISO time the terms were accepted. */
  at: string;
}

export type RecordEvent = 'accepted' | 'accepted-and-opened';

const EVENTS: Record<RecordEvent, string> = {
  accepted: 'Accepted the terms',
  'accepted-and-opened': 'Accepted the terms and opened a chapter',
};

export interface RecordInput {
  event: RecordEvent;
  /** The access code's number ("02"), never the code itself. */
  codeId: string;
  acceptance: Acceptance;
  termsSha256: string;
  chapter?: { slug: string; title: string };
  page: string;
  now: Date;
  timeZone: string;
  userAgent: string;
  language: string;
}

/** The fields of one record, as the form service emails them to the owner. */
export function buildRecord(input: RecordInput): Record<string, string> {
  const what = input.chapter ? `"${input.chapter.title}"` : 'the track';
  return {
    subject: `GRWU reading record: code ${input.codeId}, ${EVENTS[input.event].toLowerCase()} (${what})`,
    from_name: 'GRWU ringdown track',
    event: EVENTS[input.event],
    name: input.acceptance.name,
    email: input.acceptance.email,
    access_code_number: input.codeId,
    chapter: input.chapter ? `${input.chapter.title} (${input.chapter.slug})` : '',
    page: input.page,
    time_utc: input.now.toISOString(),
    reader_time_zone: input.timeZone,
    terms_version: input.acceptance.version,
    terms_accepted_at: input.acceptance.at,
    terms_sha256: input.termsSha256,
    browser: input.userAgent,
    language: input.language,
  };
}

/** A plausible full name and email: the record is only as good as what the reader signs. */
export function validAcceptance(name: string, email: string): boolean {
  return name.trim().split(/\s+/).length >= 2 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/** The mark printed over an opened chapter. */
export function watermarkText(acceptance: Acceptance, codeId: string, now: Date): string {
  return `Confidential · unpublished work of ${AUTHOR} · reading copy for ${acceptance.name} (code ${codeId}) · ${now.toISOString().slice(0, 10)}`;
}
