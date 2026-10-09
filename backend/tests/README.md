# Explore directory checks

Run from the repository root:

```sh
node --test backend/tests/providers.test.js frontend/tests/explore.test.mjs
```

Explore uses authenticated `GET /api/providers` and `GET /api/providers/:id`.
Only email-verified providers approved by an admin are returned. Responses use
an inclusive public-field projection; passwords, OTPs, contact details, NIC
images and certificate uploads are never included.

Existing providers remain compatible. Optional `providerDetails` fields are
`bio`, `serviceArea`, `latitude`, `longitude`, `price`, `priceUnit`, `rating`,
`reviewCount`, and `nextAvailableAt`. Missing values remain unknown rather than
being replaced with design examples. Coordinates represent the public service
location. Nearest sorting requests foreground location only when selected.

The existing registration/admin flows do not yet provide editors for these new
optional fields. Until real values are populated, the screen shows “Price on
request”, “Location not listed”, “Ask about availability”, and “New”. There is
no demo-data fallback or automatic database seeding.

`View profile` opens the public profile. `Continue with Provider` opens the
booking flow in the existing customer booking screen module.

## Booking flow

Restart the backend after updating so the Booking model's unique indexes are
created before requests are accepted. No packages or route architecture changed.
Approved providers publish individual future slots in the existing Provider
Dashboard. There is no default availability and no seeded production bookings.
All displayed appointment times use Asia/Colombo. Published start times are
08:00, 10:30, 12:00, 14:00, 16:30 or 18:00 within the next 90 days; these are
non-overlapping appointment windows. The provider chooses each date/time.

Customers select a published slot, enter a description/address/optional notes,
review, and submit. Prices are copied from the provider on the server; no payment
is collected. Unknown pricing stays “Price on request”. Requests begin pending.
Providers can accept or decline, then start and complete accepted jobs. My Bookings
refreshes on focus, pull-to-refresh and every 30 seconds while focused. It does
not claim to send push/email notifications. Cancelled/rejected jobs are retained
under Completed (history). Details, reschedule and cancellation work with ownership
checks; rescheduling resets status to pending and preserves entered details.

The existing booking model/controller/routes/service files contain the feature.
Endpoints under `/api/bookings` require authentication. Only customers create
requests; only approved providers publish slots. A unique sparse slot key prevents
double booking, a customer/request key makes submission retries idempotent, and
status updates use optimistic concurrency. Cancel/reject releases a reservation;
reschedule moves it atomically and leaves the old reservation intact on conflict.

```powershell
node --test backend/tests/bookings.test.js
# Integration test: run from backend, using its .env credentials.
$env:RUN_BOOKING_INTEGRATION='1'
node --test tests/bookings.test.js
```

The integration test creates a random `fixmate_booking_test_<hex>` database and
deletes only that isolated database on completion. It never alters live accounts
or bookings. It covers authenticated HTTP routes, ownership, concurrent slot
claims, validation, replay, reschedule conflict, cancellation and provider status
transitions. Requires MongoDB permission to create and remove that test database.


## Provider edit profile

Provider Profile > Edit uses the existing authenticated PATCH /api/auth/profile.
Editable fields: name, phone, bio, service area, experience and profile photo.
Email, verified category/credentials, approval, ratings, pricing and bookings are
not editable through this form. Photos use an optional User.avatar data URI,
following the existing database-backed image pattern. JPEG/PNG only, maximum
1 MiB decoded; both client and server validate input. Text and photo are saved
atomically in one user update. Empty avatar removes a photo. Existing users need
no migration. Deploy/restart the backend before using the new editor.

Provider profile/dashboard update from the successful response immediately.
Customer directory/profile reads include the current avatar; Explore refreshes
on focus and every 15 seconds while focused. An open public profile refreshes
every 15 seconds. Booking reads and mutation responses resolve the current public
provider name/photo without modifying historical booking snapshots. This is
refresh-based synchronization, not push delivery. No new packages are required.
Profile photos are excluded from the local userData session cache to avoid
SecureStore size limits; session restoration gets the saved photo from /auth/me.

Run from backend (PowerShell):

```powershell
$env:RUN_PROFILE_INTEGRATION='1'
node --test tests/provider-profile.test.js tests/providers.test.js
```

For browser-to-real-API coverage, start Expo web on port 8093, point
PLAYWRIGHT_PATH to an existing Playwright installation, and set PROFILE_BROWSER=1.
The test uses a random fixmate_profile_test_* database and deletes only that
isolated database in its cleanup. It covers persistence, invalid/oversized files,
permissions, duplicate phone, live public/booking identity, preview-before-save,
failed-save recovery, narrow layout, session reload and the customer profile.
Native-device picker/permission dialogs still require physical-device testing.

Pricing and booking reviews:

```powershell
node --test tests/reviews-pricing.test.js tests/providers.test.js
$env:RUN_REVIEW_INTEGRATION='1'
node --test tests/reviews-pricing.test.js
```

The integration test uses a random `fixmate_review_test_*` database and removes
only that database afterward. It covers review ownership, completed-booking
eligibility, invalid/stale submissions, concurrent duplicates, aggregate ratings,
public review privacy, and fixed/estimated/inspection pricing. Atlas must be reachable.

For the browser fixture test, start Expo web on port 8093, set `PLAYWRIGHT_PATH`
to an existing Playwright installation, then run
`node tests/reviews-pricing-browser.cjs` from `frontend`. It checks the actual UI
for provider price publication, review recovery, public reviews, reference prices,
and booking consent. Its intercepted API fixtures do not prove database persistence.
