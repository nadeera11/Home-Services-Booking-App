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
