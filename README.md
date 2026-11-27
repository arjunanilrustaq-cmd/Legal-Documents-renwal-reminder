# Expiry Guard

Offline Android app that reminds small-business owners in Oman to renew legal documents and to pay repeating monthly costs (salary, rent, bills). Currency is **OMR**.

There is no account, no server, and no sample catalogue. A new install is empty. Photos stay on the phone.

## Screens

Bottom tabs: **Home · Calendar · Monthly · Settings**

- **Home (Coming up)** — documents and monthly tasks in one list, soonest first. Counters for Late / Within 30 days / OK. Monthly tasks use a blue left edge. **+ Add** asks Document or Monthly task.
- **Add document** — photos (front, back, more pages) from camera or gallery, name, type chips (Company, ID/Visa, Vehicle, Insurance, Lease, Security plan approval (ROP), CCTV maintenance contract, + Other), expiry date, remind-me chips, alarm on the day, Save. Optional extras below Save: document number, renewal cost, note.
- **Document detail** — photo (tap to zoom), days-left card, next reminder, alarm, renewal cost. **Renewed: set new date** keeps the old photo and date in history. Share, Edit.
- **On the expiry day** — full-screen alarm: I renewed it / Snooze 1 hour / Remind me tomorrow. Earlier reminders are normal notifications. If still not renewed, remind daily after expiry.
- **Add monthly task** — name, type (Salary, Rent, Bills, Loan/EMI, Tax/VAT, + Other), due day (1st–31st or last day of month), repeat Monthly / Every 3 months / Yearly, optional amount OMR (3 decimals), remind-me (3 days, 1 day and On the day on by default), alarm on the day.
- **Monthly task detail** — days-left card, **Done for &lt;Month&gt;** (writes history and rolls the next due date), history with lateness, **Skip this month** (rolls forward, not recorded as done).
- **Calendar** — Sunday-first month grid with orange (document), blue (monthly) and red (expired/late) dots. Month / List toggle. List is the next 90 days (plus anything already late).
- **Settings** — business name, default reminders, reminder time, alarm on expiry day, daily reminder after expiry, app lock (PIN or fingerprint), backup/restore, monthly summary on the 1st.

## Stack

Vite + TypeScript, IndexedDB, Capacitor Android.

- App ID: `com.alaraqi.expiryguard`
- App name: Expiry Guard

## Develop

```bash
npm ci
npm test
npm run dev
```

Open `http://localhost:5173` in a phone-sized window.

```bash
npm run build:android
npx cap sync android
```

Then open `android/` in Android Studio, or assemble an APK (release signing env vars, same as CI).

## Tests

`npm test` (Vitest) covers days-left, urgency, last-day-of-month and 29/30/31 clamping including February, monthly / quarterly / yearly roll-over, skip vs done history, reminder dates, daily-after-expiry scheduling, Sunday-first calendar grids, OMR milles, backup parse, and back-button discard/exit.

## Android CI

Push to `main` runs `.github/workflows/android.yml`: tests, web build, Capacitor sync, then a GitHub Release tagged `apk-<run_number>` with asset `expiry-guard.apk`.

Signing uses the same Actions secret names as Recharge Cards (no keystore is committed):

- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

If those secrets are missing, the job **does not fail**: it publishes a debug-signed APK instead. Add the four secrets before the first build you want to keep updating.
