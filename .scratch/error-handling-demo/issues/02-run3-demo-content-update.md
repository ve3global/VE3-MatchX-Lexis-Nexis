# 02: Make Run 3's validation-error demo exercise the real character rule

**What to build:** The "Run 3 - Validation Errors (Demo)" Postman folder
should showcase the newly-accurate name-field validation from ticket 01,
not just generic missing-required-field errors, so the live demo actually
proves the replica matches the real LN portal's error handling.

Add (or replace the existing missing-field-only coverage with) a request
that submits a realistic malformed name — e.g. a forename with consecutive
apostrophes (`"O''Connor"`) or a leading hyphen (`"-Smith"`) — and asserts
the response is HTTP 422 with the specific field-level code (1286 for
forename, 1287 for surname) from ticket 01.

Regenerate the Postman collection from the generator script (the single
source of truth) and confirm live via Newman against a running `npm run
dev` instance that the new request behaves as expected, the same way the
other two demo runs were already validated.

**Blocked by:** 01 (Fix name and address field validation in report creation) — needs the real character-rule behavior to exist before a request can assert against it.

**Status:** ready-for-agent

- [ ] Run 3 includes a request submitting a malformed name and asserting
      HTTP 422 with the correct field-specific code (1286/1287)
- [ ] The Postman collection is regenerated from the generator script (not
      hand-edited) and committed
- [ ] The updated Run 3 folder is live-validated via Newman against a real
      `npm run dev` instance, run in isolation (not chained with Run 1/2),
      with all assertions passing
- [ ] `docs/postman/README.md`'s coverage/demo notes are updated to reflect
      the new request if the existing description no longer matches
