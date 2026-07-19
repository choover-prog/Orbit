# Google Calendar private live qualification

- Status: Passed
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

## Publisher preparation

These steps are performed once by Orbit's publisher or a local maintainer. They
are not part of the end-user experience.

1. Enable Google Calendar API in a private Google Cloud project.
2. Configure the Google Auth consent screen. For an external test application,
   add only the evaluating account as a test user.
3. Create a Google OAuth client of type **Desktop app**.
4. Provision the following runtime values. This repository's private local
   qualification uses ignored `.env.local`; never paste them into an issue,
   task, screenshot, log, or commit:

   ```dotenv
   ORBIT_GOOGLE_CALENDAR_MODE=live
   ORBIT_GOOGLE_CALENDAR_CLIENT_ID=<local Desktop client ID>
   ORBIT_GOOGLE_CALENDAR_CLIENT_SECRET=<local Desktop client secret>
   ORBIT_GOOGLE_CALENDAR_REDIRECT_URI=http://127.0.0.1:3000
   ```

5. Keep the Desktop client metadata publisher-owned, server-only, ignored by
   Git, and absent from screenshots and logs. PKCE is still required because a
   distributed installed app cannot rely on its generated client secret as the
   authorization-code proof.

## End-user qualification preparation

Create two temporary, overlapping events on the evaluating account's owned
primary calendar. Use neutral titles without personal information. This lets
the deterministic read-only attention rule be qualified without Orbit writing
to Calendar.

## Qualification sequence

The maintainer runs the publisher preflight before starting Orbit:

```powershell
npm run qualify:calendar -- preflight
npm run dev -- -p 3000
```

The evaluator then follows only the consumer flow: open
`http://127.0.0.1:3000/connections`, read the disclosure, choose **Connect
Google Calendar**, sign in to Google, and approve or cancel the owned-events
read-only scope. No Orbit configuration is shown to the evaluator. After Orbit
reports a fresh bounded read, the maintainer runs:

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
| Publisher configuration preflight | Passed |
| Interactive least-privilege consent | Passed |
| Fresh, complete bounded read | Passed |
| Provider-neutral record normalization | Passed |
| Deterministic read-only attention | Passed |
| DPAPI vault created without plaintext inspection | Passed |
| Disconnect cleared cache and attention | Passed |
| DPAPI vault deleted | Passed |

- Qualification date: 2026-07-19
- Orbit commit: `30cc4ff`
- Result: Passed

After all rows pass, record only the qualification date, Orbit commit, and the
word `Passed`. Do not record the account, project, client ID, event titles,
event times, event count, tokens, or encrypted blob metadata.

## Promotion gate

Gmail implementation remains blocked until every qualification row is marked
`Passed`. A failure must be diagnosed and repaired in the Calendar boundary
before its OAuth or credential-storage pattern is reused.
