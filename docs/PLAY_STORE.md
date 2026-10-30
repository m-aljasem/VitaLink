# Google Play release checklist

What the app already does is marked ✅. Items marked ☐ need your Google Play Console,
Firebase or legal input.

## Required by Google Play

- ✅ **In-app account deletion**: Settings → Delete account (calls `delete_my_account()`).
- ☐ **Web account-deletion link**: publish `website/privacy.html`; in Play Console → App content →
  Data deletion, enter `https://<your-domain>/privacy.html#delete-account`.
- ☐ **Privacy policy URL**: fill in the highlighted fields in `website/privacy.html`, publish it, and
  add the URL in Play Console → App content → Privacy policy.
- ☐ **Health apps declaration** (App content → Health apps): select *Medical / health tracking* and
  *Medication & treatment management*. VitaLink is not a regulated medical device; keep the disclaimer
  in the privacy policy and avoid diagnostic claims in the listing.
- ☐ **Target audience**: 16+ (or 18+), matching the privacy policy.

## Data safety form (App content → Data safety)

Data is encrypted in transit: **Yes**. Users can request deletion: **Yes** (in app and on the web).
No data is used for advertising or sold.

| Data type (Play category)        | Collected | Shared¹ | Purpose                              | Optional |
|----------------------------------|-----------|---------|--------------------------------------|----------|
| Email address (Personal info)    | Yes       | No      | Account management                   | No       |
| Name (Personal info)             | Yes       | Yes¹    | App functionality                    | No       |
| Other info: age, gender, country | Yes       | Yes¹    | App functionality, personalization   | Yes      |
| Health info (readings, notes, conditions, medications) | Yes | Yes¹ | App functionality         | No       |
| App interactions (provider views of data) | Yes | No   | App functionality                    | No       |

¹ Only with care providers the user explicitly connects with and only the metrics they enable.
Google defines user-initiated sharing as *not* "shared" in the form, so you may answer **No** for
sharing; describe it in the privacy policy either way.

## Notifications on Android

- Reminders and medication doses use `@capacitor/local-notifications`. The app asks for the
  Android 13+ notification permission when a reminder or medication is saved.
- Repeating notifications use inexact alarms, so they can arrive a few minutes late when the phone
  is idle. If exact timing matters, add `SCHEDULE_EXACT_ALARM` to the manifest (generated in CI by
  `npx cap add android` in `codemagic.yaml`) and declare it in Play Console.

## Push alerts for providers (not built yet)

Today providers see alerts **in the app**: live while it is open, and on the home screen next time.
Alerts while the app is closed need push notifications:

1. Create a Firebase project, add the Android app (`org.aljasem.vitalink`), and download
   `google-services.json` into `android/app/` (add it as a Codemagic secure file).
2. `npm install @capacitor/push-notifications` and register for push after sign-in; store each device
   token in a new `device_tokens (user_id, token, platform)` table with RLS `user_id = auth.uid()`.
3. Create a Supabase Edge Function that sends FCM messages, using a Firebase service-account key stored
   as a Supabase secret.
4. Add a Database Webhook on `INSERT` into `public.alerts` that calls the function with the new row;
   the function looks up the recipient's tokens and sends "<Patient>: <metric> very high".

## Health Connect import (not built yet)

Reading BP, glucose, SpO₂, heart rate and weight from Health Connect needs a Capacitor Health Connect
plugin, `READ_*` health permissions in the manifest, a permissions-rationale screen, and a Health
Connect declaration in Play Console. Test it on a real device: Google reviews these permissions strictly.

## Crash reporting (not built yet)

Add Sentry (`@sentry/capacitor` + `@sentry/angular`) with a DSN from your Sentry project, and turn off
sending of personal data (`sendDefaultPii: false`) because readings are health data.

## Store listing

- ☐ Screenshots: patient home, a reading with its "High" label, the provider home with alerts,
  medications, and dark mode. (Device frames are optional.)
- ☐ Short description (80 chars), e.g. "Track blood pressure, glucose & meds, and share safely with your care team."
