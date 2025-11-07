# VitaLink - Patient-Generated Health Data Tracker

A production-grade Ionic + Angular + Supabase app for tracking and sharing health data with care providers.

## Features

- ✅ **Email + 6-digit OTP Authentication** with persistent sessions
- ✅ **Multi-language Support** (English, Spanish, French, German, Arabic, Farsi, Urdu) with RTL support
- ✅ **Role-based Access** (Patient & Provider)
- ✅ **Health Metrics Tracking** (BP, Glucose, SpO₂, Heart Rate, Pain, Weight)
- ✅ **Granular Data Sharing** via 6-digit codes with per-metric toggles
- ✅ **Charts & Visualizations** using Chart.js
- ✅ **Data Export** (CSV/JSON) - only user's own data
- ✅ **Reminders** with Capacitor Local Notifications
- ✅ **Light Mode Only** - no dark mode

## Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Configure Supabase**
   - Create a `.env` file in the root (or update `src/environments/environment.ts`):
     ```
     VITE_SUPABASE_URL=your_supabase_url
     VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
     ```
   - Run the SQL schema from `supabase/schema.sql` in your Supabase SQL editor

3. **Run the App**
   ```bash
   npm start
   ```

## Project Structure

```
src/app/
  core/
    - supabase.client.ts      # Supabase client singleton
    - auth.service.ts          # Authentication & session management
    - profile.service.ts        # Profile CRUD
    - observation.service.ts    # Health data CRUD
    - sharing.service.ts        # Provider-patient linking
    - reminder.service.ts       # Reminders & notifications
    - export.service.ts         # Data export
    - i18n.service.ts          # Language & RTL management
    - session.guard.ts          # Route protection

  pages/
    auth/                      # Email OTP authentication
    onboarding/                # Multi-step onboarding
    tour/                      # App tour
    tabs/                      # Tab navigation
    patient/
      home/                    # Metric widgets & recent activity
      connect/                 # Provider management
      metric-detail/           # Entry form, chart, history
    settings/                   # Profile, language, export, logout

  shared/components/
    metric-card/               # Metric widget component
    line-chart/                # Chart.js wrapper
    six-digit-input/           # OTP code input

  assets/i18n/                 # Translation files
```

## Key Features Implemented

### Authentication
- Email-based OTP via Supabase
- Persistent sessions (no auto-logout on refresh)
- Session guard protects all routes

### Onboarding
- Role selection (Patient/Provider)
- Language selection with RTL support
- Profile creation
- Condition selection (patients)
- Provider details (doctors/nurses)
- Initial metrics entry

### Patient Features
- **Home**: 6 metric widgets with last values and trends
- **Metric Detail**: Entry form, line charts, history
- **Connect**: Add providers via 6-digit codes, manage sharing toggles
- **Settings**: Language, export, logout

### Data Sharing
- Providers generate 6-digit codes (15-min expiry)
- Patients redeem codes to link providers
- Per-metric sharing toggles (BP, Glucose, SpO₂, HR, Pain, Weight)
- RLS policies ensure data privacy

### Internationalization
- 7 languages with full RTL support for Arabic, Farsi, Urdu
- Automatic `dir` attribute switching
- All UI text uses translation keys

## Database Schema

See `supabase/schema.sql` for the complete schema including:
- Profiles table
- Observations table
- Provider links with sharing flags
- Link tokens (6-digit codes)
- Reminders
- RLS policies

## Next Steps

To complete the app, you may want to add:
- Provider home page with patient list
- Provider patient detail page
- Reminders management UI
- Profile edit page
- Enhanced chart features
- More comprehensive translations

## Notes

- The app uses **light mode only** - dark mode is disabled
- All routes are protected by `sessionGuard`
- Export functionality only exports the current user's data
- RLS policies enforce data privacy at the database level

