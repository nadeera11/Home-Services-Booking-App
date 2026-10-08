# FixMate cross-role booking audit — 9 October 2026

## Scope and evidence

This is an engineering regression audit, not representative-user validation. Existing architecture, dependencies, navigation tabs, manual cancellation and direct cash/bank payments were preserved. Existing Master Prompt 2 changes were retained.

Two separate test layers were used:

- Real API/database integration: randomly named `fixmate_booking_test_<random>` database, isolated accounts, guarded cleanup. Nine tests passed. The large lifecycle test exercises both roles, transactions, ownership, concurrent reservations, quote decisions, invoices, payments, calendar reconciliation and notifications.
- Browser walkthrough: real Expo application and navigators in headless Chrome, with intercepted shared in-memory API fixtures. This checks reachable controls and rendered states; the fixture transition handlers are not evidence of backend correctness. No real user accounts, bookings or payments were used.

## 1. Verified defects and severity

| Severity | Defect | Resolution |
|---|---|---|
| Critical | The admin profile file contained two identical complete modules, including duplicate default exports. This blocked whole-application compilation. | Removed only the exact duplicate copy; retained the original component. |
| High | Customer rescheduling omitted the booking version, permitting a stale screen to submit against a newer appointment. | Send the original version, retain the displayed selection on conflict and explain how to review the current booking. Added a real API regression assertion. |
| High | Cancellation used the polling-updated booking version rather than the version the customer chose to cancel. | Capture the version when cancellation confirmation opens. |
| Medium | Customer “Message provider” opened the general inbox rather than the booking conversation. | Pass booking ID/open-request parameters and consume them in the existing Messages screen. |
| Medium | Customer detail navigation stayed enabled during quote/payment mutations. Polling could race a pending mutation and a late response could reopen a dismissed detail. | Lock navigation during mutations, abort prior reads and pause polling while writing. Include support submissions in the lock. |
| Medium | Failed quote decline dismissed the decline confirmation. | Dismiss only after a successful response; preserve the recovery controls on failure. |
| Medium | Enlarging web booking text left fixed line heights cramped. | Use proportional web line heights with the same default proportions; preserve native line-height values. |
| Low | Provider tab bar lacked the explicit safe-area sizing used by customer tabs, leaving inadequate label space in browser layouts. | Apply the same safe-area height/padding pattern without changing tabs. |

## 2. Fixes and rerun evidence

- Backend: `RUN_BOOKING_INTEGRATION=1 node --test tests/bookings.test.js tests/providers.test.js` — 9 passed, no skips. Includes inspection repair approval through invoice: disclosed inspection fee included exactly once, invoice remains unpaid; stale rescheduling rejected without changing the original start.
- Frontend: `node --test tests/provider-metrics.test.mjs tests/explore.test.mjs` — 7 passed. Confirmed receipts, awaiting reports and unpaid balances are separated; Sri Lanka day boundaries and empty data are covered.
- `tsc --noEmit` — passed for the whole frontend.
- Targeted ESLint for BookingsScreen, MessagesScreen and ProviderNavigator — passed.
- Whole `src` ESLint — 3 existing admin errors and 17 warnings remain. The errors concern AdminProfileScreen, UsersScreen and VerificationScreen. They are not reported as passing checks.
- `git diff --check` — passed.
- Full Expo application bundled for web and opened with both existing role navigators.

### Browser walkthrough coverage

| Journey | Browser evidence | Server evidence |
|---|---|---|
| A. Request and acceptance | Explore → provider profile → form → published appointment → consent → request sent; provider acceptance; Active jobs after navigation/reload. | Creation, duplicate request keys, acceptance and role ownership. |
| B. Quote-required work | Unknown-price quote editor → customer approval; start/completion controls exercised on approved work. Estimate-specific UI is not a separate walkthrough. | Estimate/unknown consent and quote decision protections; approved work lifecycle. |
| C. Inspection | Record inspection, repair quote, fee disclosure on decline; approval control and agreed combined total. | Repair decline bills inspection only; repair approval/completion includes fee once. |
| D. Revision | Old/new total comparison; injected failure preserves decline confirmation; decline retains previous total; approval replaces total. | Stale quote decisions, concurrent approval/decline and revision consequences. |
| E. Scheduling types | Published request, preferred-time selection and stale submission, flexible-window reschedule; no premature confirmation. | Published/preferred/window constraints, supported times, duration and travel intervals. |
| F. Changes | Alternative proposal → customer approval; manual cancellation; stale reschedule recovery. | Cancellation, rescheduling, stale proposal checks and released reservations. |
| G. Payment | Transfer reference → report pending → provider rejection → cash re-report → provider confirmation → customer receipt. Navigation disabled during pending report. | Payment ownership, stale receipt confirmation, state transitions and paid-state idempotency. |
| H. Communication | Booking-linked chat opens; support case submits; provider notification opens job and preserves read state. | Chat/support ownership; notification read ownership. Customer notification feed is unsupported. |
| I. Availability | Provider publishes start → customer selection; date pause hides start; withdrawal leaves existing reservation visible. | Working days/off dates, reservation races, cancellation/reschedule release, directory availability and legacy preservation. |

Dashboard rendered the fixture's confirmed LKR 1,000.00 receipt and zero unpaid balance. Arithmetic across multiple records is tested separately in provider-metrics tests.

## 3. Remaining defects

- Whole-project lint remains failing on existing admin code (three errors, 17 warnings); no claim of a clean whole-project lint run.
- Customer Home still contains illustrative provider counts, prices and nearby professionals. This was observed while navigating to Bookings. It is outside this narrowly scoped booking/provider regression change and should not be presented as live directory data. Severity: Medium.
- No unresolved Critical/High booking defect was reproduced in the exercised paths. This does not establish absence of defects in untested paths.

## 4. Design recommendations (not implemented scope)

- Validate the small captions and dense quote comparisons with actual customers/providers at their preferred text sizes.
- Check modal focus restoration and announcements with TalkBack and VoiceOver before release.
- Consider a later content pass on the customer Home samples; use real records or explicitly labelled examples, without changing its composition.

## 5. Business-policy questions

No new policy was introduced or needed for these fixes. Manual cancellation and cash/bank receipt confirmation remain unchanged. Converting preserved legacy calendar intervals into appointments remains deferred: a duration/start-time policy would be needed before any migration. No intervals were silently converted or deleted.

## 6. Checks not completed / limits

- No physical Android/iOS device, native keyboard, TalkBack, VoiceOver or representative-user session was available.
- Browser CSS text enlargement and 320px viewport checks are simulations, not native font-scaling tests. Scrollable detail actions and keyboard Enter activation were exercised. Native focus/announcement behavior remains unverified.
- Browser fixtures are separate from the real database test run; a single full UI-to-live-test-backend walkthrough was not performed.
- A simulated HTTP failure was checked; every offline/disconnect/timeout permutation was not exercised.
- Customer notification feed, push delivery, automated reminders and request expiry are unsupported and were not fabricated.
- Live Figma retrieval for node 189:1522 returned “nothing selected”; exact current-file measurement/pixel parity could not be checked. Supplied design screenshots were used for qualitative comparison.

## 7. Figma consistency and essential deviations

Reviewed rendered provider job details, calendar, dashboard and customer booking details against the supplied references. Purple primary actions, pale backgrounds, white cards, typography direction, detail hierarchy and existing tab navigation remain. No screen was redesigned in this audit.

The essential visual changes are provider tab-bar safe-area space and proportional web text line spacing. Additional job groups, consent/price explanations and calendar controls from the existing implementation remain in their existing locations. Exact spacing/typeface parity with the live Figma file is unverified.

Sample text contrast calculations: primary on white 5.31:1; customer muted text on booking background 4.69:1; provider muted text on white 4.76:1; error text on its pale background 5.58:1. This is a sample check, not a complete accessibility conformance audit. Primary booking buttons have 52px minimum height; provider actions/bells have 48px targets; status labels provide non-color cues.

## Reproduce the browser check

Start Expo web on port 8093, then run from `frontend`:

```powershell
# Point to an existing Playwright installation; do not install new app dependencies.
$env:PLAYWRIGHT_PATH = '<existing Playwright module path>'
$env:FIXMATE_AUDIT_URL = 'http://localhost:8093'
node tests/cross-role-browser.cjs
```

The script intercepts `/api/` requests, uses isolated fixture identities, closes its browser, and writes screenshots/request evidence into ignored `.expo/`. It requires an installed Chrome browser. Test screenshots include `final-dashboard.png`, `final-provider.png`, `final-calendar.png`, and `final-customer-large-text.png`.
