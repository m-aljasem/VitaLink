# ⚡ Quick Start: Supabase Email Templates

Get your beautiful multilingual emails set up in 5 minutes!

## 🎯 Step 1: Copy Template to Supabase

1. Open your **Supabase Dashboard**
2. Go to **Authentication** → **Email Templates**
3. Click on **Magic Link** (or **OTP** if available)
4. Open `otp-email-en.html` from this folder
5. Copy the entire HTML content
6. Paste into Supabase's template editor
7. **Important:** Make sure `{{ .Token }}` is in the template (Supabase will replace this)
8. Click **Save**

## ✅ Done!

Your emails will now look beautiful! 🎉

---

## 🌍 Want Multilingual Support?

### Simple Approach (Recommended for Start)
Use the English template for everyone. It's professional and works globally.

### Advanced Approach
Deploy the Edge Function (`edge-functions/send-multilingual-otp/index.ts`) to automatically send emails in the user's preferred language.

See `SETUP_GUIDE.md` for detailed instructions.

---

## 📧 Template Variables

Supabase automatically replaces these:
- `{{ .Token }}` → The 6-digit verification code
- `{{ .Email }}` → User's email address
- `{{ .SiteURL }}` → Your site URL
- `{{ .RedirectTo }}` → Redirect URL

---

## 🎨 What You Get

- ✨ Beautiful gradient design
- 📱 Fully responsive
- 🔒 Security warnings
- 💎 Professional branding
- 🌐 Ready for multilingual expansion

---

**That's it!** Your emails are now sexy and professional! 🚀

