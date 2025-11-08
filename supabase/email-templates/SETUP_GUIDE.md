# 🎨 VitaLink Multilingual Email Templates Setup Guide

This guide will help you set up beautiful, multilingual email templates in Supabase for VitaLink.

## 📋 Overview

VitaLink supports 9 languages, and we want our authentication emails to match! This guide provides:
- Beautiful HTML email templates
- Multilingual support for all 9 languages
- RTL (Right-to-Left) support for Arabic, Farsi, and Urdu
- Modern, responsive design

## 🚀 Quick Setup (Recommended)

### Option 1: Use Default English Template (Simplest)

1. Go to **Supabase Dashboard** → **Authentication** → **Email Templates**
2. Select **Magic Link** template
3. Copy the content from `otp-email-en.html`
4. Paste into Supabase's template editor
5. Replace `{{ .Token }}` with the actual token variable
6. Save!

**Note:** This will send English emails to all users. For multilingual support, use Option 2.

---

### Option 2: Use Edge Function for Multilingual Emails (Advanced)

This requires deploying a Supabase Edge Function that detects the user's language and sends the appropriate template.

#### Step 1: Deploy Edge Function

1. Install Supabase CLI:
   ```bash
   npm install -g supabase
   ```

2. Login to Supabase:
   ```bash
   supabase login
   ```

3. Link your project:
   ```bash
   supabase link --project-ref your-project-ref
   ```

4. Deploy the function:
   ```bash
   supabase functions deploy send-multilingual-otp
   ```

#### Step 2: Configure Supabase Auth Hook

1. Go to **Database** → **Webhooks** in Supabase Dashboard
2. Create a new webhook that triggers on `auth.users` insert
3. Point it to your Edge Function
4. The function will automatically detect language from user's profile

---

## 📧 Available Templates

### 1. OTP Email Template (`otp-email-en.html`)
- **Purpose:** Email verification codes
- **Languages:** English (base template)
- **Use for:** Quick setup, English-only users

### 2. Multilingual Template (`multilingual-otp-template.html`)
- **Purpose:** Template with variable placeholders
- **Languages:** All 9 languages (via variables)
- **Use for:** Edge Function integration

### 3. Language-Specific Templates
Individual templates for each language:
- `otp-email-en.html` - English
- `otp-email-es.html` - Spanish
- `otp-email-ar.html` - Arabic (RTL)

---

## 🌍 Supported Languages

| Language | Code | RTL | Template File |
|----------|------|-----|---------------|
| English | `en` | ❌ | `otp-email-en.html` |
| Español | `es` | ❌ | Create from `otp-email-en.html` |
| Français | `fr` | ❌ | Create from `otp-email-en.html` |
| Deutsch | `de` | ❌ | Create from `otp-email-en.html` |
| العربية | `ar` | ✅ | `otp-email-ar.html` |
| فارسی | `fa` | ✅ | Create from `otp-email-ar.html` |
| اردو | `ur` | ✅ | Create from `otp-email-ar.html` |
| 中文 | `zh` | ❌ | Create from `otp-email-en.html` |
| 日本語 | `ja` | ❌ | Create from `otp-email-en.html` |

---

## 🎨 Template Features

### Visual Design
- ✨ **Gradient Background** - Beautiful purple gradient
- 🎯 **Modern Card Design** - Rounded corners, shadows
- 💎 **Glassmorphism** - Frosted glass effect on logo
- 📱 **Fully Responsive** - Works on all devices
- 🎭 **Animated Header** - Subtle pulse animation

### Security Features
- 🔒 Security warnings
- ⏰ Clear expiration times
- 🛡️ Professional branding
- 📧 Clear sender identification

### Multilingual Support
- 🌐 9 languages supported
- ↔️ RTL support for Arabic, Farsi, Urdu
- 📝 All text properly translated
- 🎯 Cultural sensitivity

---

## 📝 Supabase Template Variables

When using templates in Supabase, you can use these variables:

- `{{ .Token }}` - The verification code (6 digits)
- `{{ .Email }}` - User's email address
- `{{ .SiteURL }}` - Your site URL
- `{{ .RedirectTo }}` - Redirect URL after verification
- `{{ .ConfirmationURL }}` - Full confirmation URL

---

## 🔧 Customization

### Change Colors

Edit the gradient colors in the CSS:
```css
background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%);
```

### Add Logo Image

Replace the logo placeholder:
```html
<div class="logo">
    <img src="https://vitalink.app/assets/icon/vitalink.png" alt="VitaLink" style="width: 100%; height: 100%; object-fit: contain;" />
</div>
```

### Modify Expiry Time

Change the expiry message in the template:
```html
<div class="code-expiry">This code expires in 1 hour</div>
```

---

## 📚 Translation Reference

All translations are available in `email-translations.json`. Use this file to:
- Reference translations when creating new templates
- Update existing translations
- Add new languages

---

## 🐛 Troubleshooting

### Emails not sending?
- Check Supabase project settings
- Verify SMTP configuration
- Check spam folder

### Template not rendering?
- Ensure HTML is valid
- Check variable syntax (`{{ .Token }}`)
- Test in email client preview

### Language not detected?
- Verify user profile has `language` field set
- Check Edge Function logs
- Ensure function is properly deployed

---

## 📖 Additional Resources

- [Supabase Email Templates Docs](https://supabase.com/docs/guides/auth/auth-email-templates)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Email HTML Best Practices](https://www.campaignmonitor.com/dev-resources/guides/coding/)

---

## 💡 Tips

1. **Test First**: Always test emails in multiple clients (Gmail, Outlook, Apple Mail)
2. **Mobile First**: Ensure templates look good on mobile devices
3. **Keep It Simple**: Don't overcomplicate the design
4. **Brand Consistency**: Match your app's design language
5. **Accessibility**: Use proper contrast ratios and readable fonts

---

**Need Help?** Check the main README or open an issue on GitHub.

