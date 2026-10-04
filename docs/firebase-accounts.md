# Accounts and device synchronization

This static GitHub Pages app uses the existing `cash-handling-quiz` Firebase web app and its Standard edition `(default)` Firestore database. Email/password is enabled. Public signup is disabled at the backend through `client.permissions.disabledUserSignup`. Only the administrator-created UID in `account-access.mjs` may sign in to the site or use Firestore. Public web identifiers are in `firebase-config.mjs`; passwords and administrator credentials never belong in the repository.

Open Private account to sign in or sign out. Password visibility and optional device persistence are available. The approved account has its own device cache. Signing out restores the original guest data. On account changes the page reloads to clear in-memory gameplay and settings from the previous identity. The initial setup remains inactive until account initialization finishes; if the SDK cannot load, guest gameplay remains available with an account error and Retry connection.

An explicit Import existing device history & settings button appears after initial server loading when guest data has not yet been imported. It preserves original timestamps, raw answers and fields, retains the guest copy, filters Sample Data, and skips records/settings already present in the account. Stable IDs and a per-account import fingerprint prevent duplicate imports. If additional guest gameplay is created later, importing can be offered again.

Each real attempt is a document beneath `users/{uid}/gameHistory/{id}`. Chess games and lesson attempts use that collection with distinct source-key prefixes. Settings, current chess game, theme, chart appearance, typing presets, Multitasker settings and current practice challenge are beneath `users/{uid}/settings/{id}`. Scores, personal bests, strengths, weaknesses, charts and recommendations are derived from these synchronized records by the existing analytics. Sample histories stay in session storage and do not pass through the sync adapter.

Documents contain a versioned envelope with the source key, JSON payload, device identifier, modification time and deletion marker. JSON retains nested game evidence without Firestore's nested-array restriction. Transactions compare revisions before writing; a newer cloud revision wins over an older offline update. Completed attempts take precedence over unfinished checkpoints. Independent attempt IDs merge across devices. Conflicting edits to one settings document use modification time, with device ID breaking ties. Device clocks should be accurate. Clearing real history synchronizes tombstones for known records, preventing an old offline copy from re-importing deleted records.

Gameplay writes synchronously to an account-specific local cache, then queues background transactions. Pending writes survive reloads. Offline writes remain in the queue until reconnection; transient failures retry and remain visible as Sync error. Firestore also uses IndexedDB persistence with multiple-tab support where the browser supports it. This is temporary offline operation of an already loaded app; the site does not install an offline application service worker. Each payload is limited to 900 KB by the rules; oversized evidence remains locally preserved with a sync error rather than being silently truncated.

Rules deny all paths except the single approved UID's owner-only history/settings documents and validate their envelopes. Clients use tombstones and cannot physically delete documents. Adding another approved account requires an intentional policy and rules update.

Check & ID Fraud Inspection is disabled for guests, with a sign-in link and guards for starting games, practice recommendations and subsequent cases. All other games remain available to guests, whose history stays browser-specific. GitHub Pages and the public repository expose game code: this is website access control, not secrecy or an unbypassable protection for client-side game logic. Saved account data is protected by server-enforced rules.

Verification:

```powershell
node --test tests/*.test.mjs
$env:QUIZ_FOCUSED = 'firebase'
node tests/browser-smoke.mjs
```

The Firebase browser suite checks guest restrictions and live signup API denial. Set `QUIZ_EMULATORS=1` with local Auth (9309) and Firestore (9088) emulators for approved/unapproved login, Fraud gameplay, two profiles, offline recovery and rules checks. Approved gameplay tests use emulator credentials and data only; they never change the real owner's password or history. `QUIZ_FOCUSED=fraud` with those emulators runs detailed Fraud/Hold regressions. Supply Playwright through `NODE_PATH` when using the bundled runtime. Recheck live backend settings and the deployed guest interface after release.

Deploy rules using `firebase deploy --only firestore:rules --project cash-handling-quiz`. Deploy website assets through the existing GitHub Pages workflow; it includes the new account modules. Check both local browser behavior and the deployed origin.
