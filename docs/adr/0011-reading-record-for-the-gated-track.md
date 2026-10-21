# 11. A reading record for the gated track

- Status: accepted
- Date: 2026-10-21

## Context

The ringdown track (ADR 0007) teaches an unpublished manuscript. The owner gives readers
personal access codes and needs a dated record, kept outside the site, that each reader
opened the track and on what terms. The record has to work on a static site with no server, so it
cannot depend on anything the reader's browser alone keeps.

## Decision

- **Terms first.** Before a code's first use the reader accepts written terms in their own
  name and email: the work is unpublished, it is shared with them personally, it may not be
  copied, shared or reused without the author's written permission, and the acceptance is
  recorded. The wording and its version live in `src/lib/access-record.ts`; every record
  carries the version and the SHA-256 of the exact text accepted.
- **Recorded once.** The acceptance is posted, with the chapter it opened, to the form service
  that already carries access requests (Web3Forms, `PUBLIC_ACCESS_FORM_KEY`), which emails the
  owner with its own timestamp. A record names the code by its number only, never the code,
  and gives the reader's name and email, the chapter, the page, the time (UTC and the
  reader's time zone), the terms version and the browser. Seeing one chapter is seeing the
  track, so later visits are not recorded again; a new browser or device asks for the terms,
  and so records, once more.
- **No record, no access.** Nothing opens until the acceptance's record has gone through; if
  the post fails, the chapter stays closed with a "Try again" button.
- **The copy carries the reader.** An opened chapter starts with a notice naming the reader
  and the code number, and a faint repeated watermark with the same information covers the
  page on screen and in print.
- Tests use a stand-in code and chapter and intercept the form service, so no real code or
  article appears in this repository (`tests/e2e/ringdown-record.spec.ts`).

## Consequences

- The owner's inbox holds the record: one email per reader (per browser they use), timestamped
  by the email provider and the form service, not by the reader.
- The record happens in the reader's browser. Someone who reproduced the decryption by hand
  could read without a record; the terms they accepted, the code number on every record and
  the watermark on every copy are what make that a breach rather than a slip.
- The free Web3Forms plan allows 250 submissions a month, ample for a few readers.
- Readers who opened chapters before this change are asked to accept the terms on their next
  visit, since their acceptance is not on record.
