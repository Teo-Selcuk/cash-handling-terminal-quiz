# Accounts and device synchronization

This static GitHub Pages app uses the existing `cash-handling-quiz` Firebase web app and its Standard edition `(default)` Firestore database. Email/password is enabled and verified; Google is disabled and its button is hidden. Public web identifiers are in `firebase-config.mjs`. No administrator credentials belong in this repository.

Open Account to sign up, sign in or sign out. Each account has its own device cache. Signing out restores the original guest data. On account changes the page reloads to clear in-memory gameplay and settings from the previous identity. The initial setup remains inactive until account initialization finishes; if the SDK cannot load, guest gameplay remains available with an account error and Retry connection.

An explicit Import existing device history & settings button appears after initial server loading when guest data has not yet been imported. It preserves original timestamps, raw answers and fields, retains the guest copy, filters Sample Data, and skips records/settings already present in the account. Stable IDs and a per-account import fingerprint prevent duplicate imports. If additional guest gameplay is created later, importing can be offered again.

Each real attempt is a document beneath `users/{uid}/gameHistory/{id}`. Chess games and lesson attempts use that collection with distinct source-key prefixes. Settings, current chess game, theme, chart appearance, typing presets, Multitasker settings and current practice challenge are beneath `users/{uid}/settings/{id}`. Scores, personal bests, strengths, weaknesses, charts and recommendations are derived from these synchronized records by the existing analytics. Sample histories stay in session storage and do not pass through the sync adapter.

Documents contain a versioned envelope with the source key, JSON payload, device identifier, modification time and deletion marker. JSON retains nested game evidence without Firestore's nested-array restriction. Transactions compare revisions before writing; a newer cloud revision wins over an older offline update. Completed attempts take precedence over unfinished checkpoints. Independent attempt IDs merge across devices. Conflicting edits to one settings document use modification time, with device ID breaking ties. Device clocks should be accurate. Clearing real history synchronizes tombstones for known records, preventing an old offline copy from re-importing deleted records.

Gameplay writes synchronously to an account-specific local cache, then queues background transactions. Pending writes survive reloads. Offline writes remain in the queue until reconnection; transient failures retry and remain visible as Sync error. Firestore also uses IndexedDB persistence with multiple-tab support where the browser supports it. This is temporary offline operation of an already loaded app; the site does not install an offline application service worker. Each payload is limited to 900 KB by the rules; oversized evidence remains locally preserved with a sync error rather than being silently truncated.

Rules deny all paths except owner-only history/settings documents and validate their envelopes. Clients use tombstones and cannot physically delete documents. Change provider flags only after checking the backend; authorized Google OAuth domains must be configured before enabling that button.

Verification:

```powershell
node --test tests/*.test.mjs
$env:QUIZ_FOCUSED = 'firebase'
node tests/browser-smoke.mjs
```

The Firebase browser suite deliberately uses the live project, creates temporary test accounts and real synthetic game attempts, and tests migration, two profiles, sign out/in, offline reconnection, concurrent attempts, Sample Data isolation, Hold responses, Multitasker, Chess and cross-account read/write denial. It writes only generated test UID/email metadata to ignored `.artifacts/firebase-test-users.json` for cleanup. It runs only when explicitly selected, never in ordinary CI. Supply Playwright through `NODE_PATH` when using the bundled runtime.

Deploy rules using `firebase deploy --only firestore:rules --project cash-handling-quiz`. Deploy website assets through the existing GitHub Pages workflow; it includes the new account modules. Check both local browser behavior and the deployed origin.
