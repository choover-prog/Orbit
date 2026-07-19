# Google Calendar private live qualification

- Status: Pending local OAuth configuration and interactive consent
- Scope: One Windows user, owned primary-calendar events, local-only
- Evidence policy: Record health and counts only; never record account identity,
  event content, OAuth values, tokens, network bodies, or vault ciphertext

## Purpose

This checkpoint proves that the already-reviewed Calendar boundary works with a
real private grant before Orbit reuses the pattern for Gmail. It does not make
the connector hosted, multi-user, continuously synchronized, or authorized to
write.

The qualification helper reads the local snapshot into memory but emits only
mode, health, record count, freshness presence, attention presence, and vault
lifecycle results. It never prints normalized records or opens the encrypted
credential file.

## Private preparation

1. Enable Google Calendar API in a private Google Cloud project.
2. Configure the Google Auth consent screen. For an external test application,
   add only the evaluating account as a test user.
3. Create a Google OAuth client of type **Desktop app**.
4. Put the following values in ignored `.env.local`; never paste them into an
   issue, task, screenshot, log, or commit:

   ```dotenv
   ORBIT_GOOGLE_CALENDAR_MODE=live
   ORBIT_GOOGLE_CALENDAR_CLIENT_ID=<local Desktop client ID>
   ORBIT_GOOGLE_CALENDAR_REDIRECT_URI=http://127.0.0.1:3000
   ```

5. Create two temporary, overlapping events on the evaluating account's owned
   primary calendar. Use neutral titles without personal information. This lets
   the deterministic read-only attention rule be qualified without Orbit
   writing to Calendar.

## Qualification sequence

Run the preflight before starting Orbit:

```powershell
npm run qualify:calendar -- preflight
npm run dev -- -p 3000
```

Open `http://127.0.0.1:3000/connections`, read the live disclosure, choose
**Connect Google Calendar**, and approve only the owned-events read-only scope.
After Orbit reports a fresh bounded read, run:

```powershell
npm run qualify:calendar -- connected
```

The connected phase must prove live mode, connected authorization, a fresh and
complete bounded read, normalized record count, freshness provenance, one
deterministic attention item, and a bounded DPAPI ciphertext vault.

Then use the UI's disconnect confirmation and run:

```powershell
npm run qualify:calendar -- disconnected
```

The disconnected phase must prove disconnected health, zero cached Calendar
records, no Calendar attention, and deletion of the local vault. The evaluator
should also remove the two temporary events directly in Google Calendar after
the checkpoint.

## Qualification record

Do not mark this record complete from fixtures or automated provider mocks.

| Check | Result |
| --- | --- |
| Private configuration preflight | Pending |
| Interactive least-privilege consent | Pending |
| Fresh, complete bounded read | Pending |
| Provider-neutral record normalization | Pending |
| Deterministic read-only attention | Pending |
| DPAPI vault created without plaintext inspection | Pending |
| Disconnect cleared cache and attention | Pending |
| DPAPI vault deleted | Pending |

After all rows pass, record only the qualification date, Orbit commit, and the
word `Passed`. Do not record the account, project, client ID, event titles,
event times, event count, tokens, or encrypted blob metadata.

## Promotion gate

Gmail implementation remains blocked until every qualification row is marked
`Passed`. A failure must be diagnosed and repaired in the Calendar boundary
before its OAuth or credential-storage pattern is reused.
