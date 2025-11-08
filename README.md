<div align="center">

# 💚 VitaLink

### Your Family's Health, Always Within Reach

**A revolutionary health tracking app that breaks language barriers, connecting families and healthcare providers globally.**

[![Angular](https://img.shields.io/badge/Angular-20.0-red.svg?style=for-the-badge&logo=angular)](https://angular.io/)
[![Ionic](https://img.shields.io/badge/Ionic-8.0-3880FF.svg?style=for-the-badge&logo=ionic)](https://ionicframework.com/)
[![Supabase](https://img.shields.io/badge/Supabase-2.80-3ECF8E.svg?style=for-the-badge&logo=supabase)](https://supabase.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6.svg?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-Open%20Source-green.svg?style=for-the-badge)](LICENSE)

[🌐 Website](https://vitalink.app) • [📱 Download](#-download) • [📖 Documentation](#-features) • [🐛 Report Bug](https://github.com/m-aljasem/VitaLink/issues) • [💡 Request Feature](https://github.com/m-aljasem/VitaLink/issues)

---

</div>

## ✨ Overview

**VitaLink** is a production-grade health tracking application that empowers families worldwide to monitor loved ones' health in real-time, regardless of geographical boundaries or language barriers. Built with modern web technologies, VitaLink provides a secure, intuitive, and multilingual platform for tracking vital signs and sharing health data with healthcare providers.

### 🎯 Why VitaLink?

- 🌍 **Global Healthcare Access** - Monitor family health from anywhere in the world
- 🗣️ **9 Languages Supported** - Breaking down language barriers in healthcare
- 🔒 **Bank-Level Security** - End-to-end encryption and secure data storage
- 📱 **Offline-First** - Works seamlessly without internet, syncs automatically
- 👨‍⚕️ **Provider Integration** - Seamless sharing with healthcare teams
- 📊 **Beautiful Analytics** - Stunning visualizations and health insights

---

## 🚀 Features

### 🔐 Authentication & Security
- ✅ **Email + OTP Authentication** - Secure 6-digit code verification
- ✅ **Persistent Sessions** - Stay logged in across sessions
- ✅ **Row-Level Security** - Database-level privacy enforcement
- ✅ **End-to-End Encryption** - Your data is yours alone

### 🌐 Internationalization
- ✅ **9 Languages** - English, Español, Français, Deutsch, العربية, فارسی, اردو, 中文, 日本語
- ✅ **RTL Support** - Full right-to-left support for Arabic, Farsi, and Urdu
- ✅ **Cultural Sensitivity** - Designed for diverse healthcare practices

### 📊 Health Tracking
- ✅ **Comprehensive Metrics** - Blood Pressure, Glucose, SpO₂, Heart Rate, Pain, Weight
- ✅ **Visual Analytics** - Beautiful charts and trend analysis with Chart.js
- ✅ **Smart Reminders** - Personalized health reminders with notifications
- ✅ **Data Export** - Export your health data as CSV or JSON

### 👥 Provider Sharing
- ✅ **6-Digit Code System** - Secure provider-patient linking
- ✅ **Granular Control** - Choose exactly what metrics to share
- ✅ **Real-Time Updates** - Providers see updates instantly
- ✅ **Multi-Provider Support** - Connect with multiple healthcare providers

### 📱 Platform Support
- ✅ **Progressive Web App** - Install as a web app on any device
- ✅ **Android Support** - Native Android app via Capacitor
- ✅ **Offline-First** - Works without internet connection
- ✅ **Responsive Design** - Beautiful on all screen sizes

---

## 📸 Screenshots

<div align="center">

### 🏠 Home Dashboard
*Quick overview of all your health metrics at a glance*

### 📊 Detailed Analytics
*Track trends and patterns with beautiful charts*

### 👨‍⚕️ Provider Dashboard
*Healthcare providers can monitor multiple patients*

### 🌐 Multilingual Interface
*Switch between 9 languages seamlessly*

</div>

> 💡 *Screenshots coming soon! Add your app screenshots here to showcase the beautiful interface.*

---

## 🛠️ Tech Stack

### Frontend
- **[Angular](https://angular.io/)** 20.0 - Modern web framework
- **[Ionic](https://ionicframework.com/)** 8.0 - Cross-platform UI components
- **[TypeScript](https://www.typescriptlang.org/)** 5.8 - Type-safe development
- **[Chart.js](https://www.chartjs.org/)** 4.5 - Beautiful data visualizations
- **[Tailwind CSS](https://tailwindcss.com/)** 4.1 - Utility-first CSS

### Backend & Services
- **[Supabase](https://supabase.com/)** 2.80 - Backend as a Service
  - PostgreSQL Database
  - Row-Level Security (RLS)
  - Authentication
  - Real-time subscriptions

### Mobile
- **[Capacitor](https://capacitorjs.com/)** 7.4 - Native mobile runtime
  - Local Notifications
  - Haptics
  - Status Bar
  - App lifecycle

### Internationalization
- **[ngx-translate](https://github.com/ngx-translate/core)** 17.0 - Multi-language support

---

## 📦 Installation

### Prerequisites

- **Node.js** 18+ and npm
- **Supabase Account** (free tier works)
- **Git**

### Quick Start

1. **Clone the repository**
   ```bash
   git clone https://github.com/m-aljasem/VitaLink.git
   cd VitaLink
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Supabase**
   - Create a new project at [supabase.com](https://supabase.com)
   - Copy your project URL and anon key
   - Create a `.env` file in the root:
     ```env
     VITE_SUPABASE_URL=your_supabase_project_url
     VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
     ```
   - Run the SQL schema from `supabase/schema.sql` in your Supabase SQL editor

4. **Run the development server**
   ```bash
   npm start
   ```
   The app will open at `http://localhost:4200`

### Building for Production

```bash
# Build for web
npm run build

# Build for Android
npm run build
npx cap sync android
npx cap open android
```

---

## 🎯 Usage

### For Patients

1. **Sign Up / Login** - Enter your email and verify with 6-digit code
2. **Complete Onboarding** - Set up your profile and initial health data
3. **Track Metrics** - Log your vital signs regularly
4. **Share with Providers** - Connect with healthcare providers using 6-digit codes
5. **View Analytics** - Monitor trends and patterns in your health data

### For Healthcare Providers

1. **Create Provider Account** - Sign up as a healthcare provider
2. **Generate Link Code** - Create a 6-digit code to share with patients
3. **Monitor Patients** - View connected patients' health data in real-time
4. **Track Metrics** - See trends and patterns across all patients

---

## 📁 Project Structure

```
VitaLink/
├── src/
│   ├── app/
│   │   ├── core/              # Core services & utilities
│   │   │   ├── auth.service.ts
│   │   │   ├── profile.service.ts
│   │   │   ├── observation.service.ts
│   │   │   ├── sharing.service.ts
│   │   │   └── i18n.service.ts
│   │   ├── pages/            # Application pages
│   │   │   ├── auth/         # Authentication
│   │   │   ├── onboarding/   # User onboarding
│   │   │   ├── patient/      # Patient features
│   │   │   └── settings/     # Settings
│   │   └── shared/           # Shared components
│   ├── assets/
│   │   ├── icon/             # App icons & logos
│   │   └── i18n/             # Translation files
│   └── environments/          # Environment configs
├── supabase/
│   └── schema.sql            # Database schema
├── website/                  # Marketing website
└── package.json
```

---

## 🌍 Supported Languages

| Language | Code | RTL Support |
|----------|------|-------------|
| English | `en` | ❌ |
| Español | `es` | ❌ |
| Français | `fr` | ❌ |
| Deutsch | `de` | ❌ |
| العربية | `ar` | ✅ |
| فارسی | `fa` | ✅ |
| اردو | `ur` | ✅ |
| 中文 | `zh` | ✅ |
| 日本語 | `ja` | ❌ |

---

## 🔒 Security & Privacy

- **Row-Level Security (RLS)** - Database-level access control
- **End-to-End Encryption** - Secure data transmission
- **Granular Sharing Controls** - You decide what to share
- **No Data Mining** - Your health data stays private
- **GDPR Compliant** - Export and delete your data anytime

---

## 🤝 Contributing

Contributions are welcome! Here's how you can help:

1. **Fork the repository**
2. **Create a feature branch** (`git checkout -b feature/amazing-feature`)
3. **Commit your changes** (`git commit -m 'Add some amazing feature'`)
4. **Push to the branch** (`git push origin feature/amazing-feature`)
5. **Open a Pull Request**

### Development Guidelines

- Follow the existing code style
- Write meaningful commit messages
- Add tests for new features
- Update documentation as needed
- Ensure all tests pass

---

## 📝 License

This project is open source and available under the [MIT License](LICENSE).

---

## 👨‍💻 Author

**Mohamad AlJasem** - MD MPH MSc

- 🌐 Website: [vitalink.app](https://vitalink.app)
- 💼 GitHub: [@m-aljasem](https://github.com/m-aljasem)
- 📧 Email: [Your Email]

---

## 🙏 Acknowledgments

- Built with ❤️ for families worldwide
- Inspired by the need to connect families across borders
- Powered by amazing open-source technologies

---

<div align="center">

### ⭐ Star this repo if you find it helpful!

**Made with ❤️ by [Mohamad AlJasem](https://github.com/m-aljasem)**

[⬆ Back to Top](#-vitalink)

</div>
