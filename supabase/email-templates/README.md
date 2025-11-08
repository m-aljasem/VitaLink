# VitaLink Email Templates

Beautiful, multilingual email templates for Supabase authentication emails.

## 📧 Available Templates

1. **OTP Email Template** - For email verification codes
2. **Magic Link Template** - For passwordless login links
3. **Password Reset Template** - For password reset requests

## 🌍 Multilingual Support

Each template includes translations for all 9 supported languages:
- English (en)
- Español (es)
- Français (fr)
- Deutsch (de)
- العربية (ar)
- فارسی (fa)
- اردو (ur)
- 中文 (zh)
- 日本語 (ja)

## 🚀 Setup Instructions

### 1. Access Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to **Authentication** → **Email Templates**
3. Select the template you want to customize (Magic Link, Change Email, etc.)

### 2. Configure Email Templates

For each email type, you'll need to:

1. **Copy the HTML template** from the corresponding file
2. **Paste it into Supabase's email template editor**
3. **Customize variables** as needed:
   - `{{ .Token }}` - The verification code
   - `{{ .Email }}` - The user's email address
   - `{{ .SiteURL }}` - Your site URL
   - `{{ .RedirectTo }}` - Redirect URL after verification

### 3. Language Detection

Since Supabase doesn't natively support language detection in emails, you have two options:

#### Option A: Use User's Language Preference (Recommended)
Create a Supabase Edge Function that:
1. Checks the user's language preference from the `profiles` table
2. Sends the appropriate language template

#### Option B: Default to English
Use the English template as default, which works for all users.

## 📝 Template Variables

Supabase provides these variables in email templates:

- `{{ .Token }}` - Verification code or magic link token
- `{{ .Email }}` - User's email address
- `{{ .SiteURL }}` - Your site URL
- `{{ .RedirectTo }}` - Redirect URL after verification
- `{{ .ConfirmationURL }}` - Full confirmation URL
- `{{ .TokenHash }}` - Hashed token (for security)

## 🎨 Customization

### Colors
The templates use VitaLink's brand colors:
- Primary: `#667eea` (Purple)
- Secondary: `#764ba2` (Deep Purple)
- Accent: `#f093fb` (Pink)
- Background: `#f0f4ff` (Light Purple)

### Logo
Replace the logo placeholder with your actual VitaLink logo URL:
```html
<img src="https://vitalink.app/assets/icon/vitalink.png" alt="VitaLink" />
```

## 📱 Responsive Design

All templates are fully responsive and work on:
- Desktop email clients (Gmail, Outlook, Apple Mail)
- Mobile email clients (iOS Mail, Gmail App)
- Webmail clients (Gmail Web, Outlook Web)

## 🔒 Security Features

- Clear expiration times
- Security warnings about not sharing codes
- Professional branding to prevent phishing
- Clear sender identification

## 📚 Additional Resources

- [Supabase Email Templates Documentation](https://supabase.com/docs/guides/auth/auth-email-templates)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)

