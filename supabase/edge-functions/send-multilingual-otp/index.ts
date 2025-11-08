// Supabase Edge Function for Multilingual OTP Emails
// Deploy this function to handle language-specific email templates

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Email translations
const translations: Record<string, any> = {
  en: {
    title: "Your VitaLink Verification Code",
    headerText: "Verify Your Email",
    greeting: "Hello!",
    welcomeMessage: "Welcome to <strong>VitaLink</strong>! We're excited to have you join us in tracking your health and staying connected with your loved ones.",
    codeLabel: "Your Verification Code",
    expiryText: "This code expires in 1 hour",
    instructions: "Enter this code in the VitaLink app to complete your verification. If you didn't request this code, please ignore this email.",
    securityIcon: "🔒",
    securityText: "Security Tip: Never share this code with anyone. VitaLink staff will never ask for your verification code.",
    tagline: "Your Family's Health, Always Within Reach",
    taglineSub: "Connecting families to health, globally.",
    visitWebsite: "Visit Website",
    support: "Support",
    footerText: "This email was sent to",
    direction: "ltr"
  },
  es: {
    title: "Tu Código de Verificación de VitaLink",
    headerText: "Verifica Tu Correo",
    greeting: "¡Hola!",
    welcomeMessage: "¡Bienvenido a <strong>VitaLink</strong>! Estamos emocionados de tenerte con nosotros para rastrear tu salud y mantenerte conectado con tus seres queridos.",
    codeLabel: "Tu Código de Verificación",
    expiryText: "Este código expira en 1 hora",
    instructions: "Ingresa este código en la aplicación VitaLink para completar tu verificación. Si no solicitaste este código, por favor ignora este correo.",
    securityIcon: "🔒",
    securityText: "Consejo de Seguridad: Nunca compartas este código con nadie. El personal de VitaLink nunca te pedirá tu código de verificación.",
    tagline: "La Salud de Tu Familia, Siempre al Alcance",
    taglineSub: "Conectando familias a la salud, globalmente.",
    visitWebsite: "Visitar Sitio Web",
    support: "Soporte",
    footerText: "Este correo fue enviado a",
    direction: "ltr"
  },
  fr: {
    title: "Votre Code de Vérification VitaLink",
    headerText: "Vérifiez Votre Email",
    greeting: "Bonjour !",
    welcomeMessage: "Bienvenue sur <strong>VitaLink</strong> ! Nous sommes ravis de vous accueillir pour suivre votre santé et rester connecté avec vos proches.",
    codeLabel: "Votre Code de Vérification",
    expiryText: "Ce code expire dans 1 heure",
    instructions: "Entrez ce code dans l'application VitaLink pour compléter votre vérification. Si vous n'avez pas demandé ce code, veuillez ignorer cet email.",
    securityIcon: "🔒",
    securityText: "Conseil de Sécurité : Ne partagez jamais ce code avec qui que ce soit. Le personnel de VitaLink ne vous demandera jamais votre code de vérification.",
    tagline: "La Santé de Votre Famille, Toujours à Portée",
    taglineSub: "Connecter les familles à la santé, mondialement.",
    visitWebsite: "Visiter le Site",
    support: "Support",
    footerText: "Cet email a été envoyé à",
    direction: "ltr"
  },
  de: {
    title: "Ihr VitaLink Bestätigungscode",
    headerText: "Bestätigen Sie Ihre E-Mail",
    greeting: "Hallo!",
    welcomeMessage: "Willkommen bei <strong>VitaLink</strong>! Wir freuen uns, dass Sie dabei sind, Ihre Gesundheit zu verfolgen und mit Ihren Lieben verbunden zu bleiben.",
    codeLabel: "Ihr Bestätigungscode",
    expiryText: "Dieser Code läuft in 1 Stunde ab",
    instructions: "Geben Sie diesen Code in der VitaLink-App ein, um Ihre Bestätigung abzuschließen. Wenn Sie diesen Code nicht angefordert haben, ignorieren Sie bitte diese E-Mail.",
    securityIcon: "🔒",
    securityText: "Sicherheitstipp: Teilen Sie diesen Code niemals mit jemandem. Das VitaLink-Personal wird Sie niemals nach Ihrem Bestätigungscode fragen.",
    tagline: "Die Gesundheit Ihrer Familie, Immer in Reichweite",
    taglineSub: "Familien weltweit mit Gesundheit verbinden.",
    visitWebsite: "Website Besuchen",
    support: "Support",
    footerText: "Diese E-Mail wurde an gesendet",
    direction: "ltr"
  },
  ar: {
    title: "رمز التحقق الخاص بك من VitaLink",
    headerText: "تحقق من بريدك الإلكتروني",
    greeting: "مرحباً!",
    welcomeMessage: "مرحباً بك في <strong>VitaLink</strong>! نحن متحمسون لانضمامك إلينا لتتبع صحتك والبقاء على اتصال مع أحبائك.",
    codeLabel: "رمز التحقق الخاص بك",
    expiryText: "ينتهي هذا الرمز خلال ساعة واحدة",
    instructions: "أدخل هذا الرمز في تطبيق VitaLink لإكمال التحقق. إذا لم تطلب هذا الرمز، يرجى تجاهل هذا البريد الإلكتروني.",
    securityIcon: "🔒",
    securityText: "نصيحة أمنية: لا تشارك هذا الرمز مع أي شخص أبداً. لن يطلب موظفو VitaLink منك رمز التحقق الخاص بك أبداً.",
    tagline: "صحة عائلتك، دائماً في متناول اليد",
    taglineSub: "ربط العائلات بالصحة، عالمياً.",
    visitWebsite: "زيارة الموقع",
    support: "الدعم",
    footerText: "تم إرسال هذا البريد الإلكتروني إلى",
    direction: "rtl"
  },
  fa: {
    title: "کد تأیید VitaLink شما",
    headerText: "ایمیل خود را تأیید کنید",
    greeting: "سلام!",
    welcomeMessage: "به <strong>VitaLink</strong> خوش آمدید! ما هیجان‌زده هستیم که شما به ما بپیوندید تا سلامت خود را ردیابی کنید و با عزیزان خود در ارتباط باشید.",
    codeLabel: "کد تأیید شما",
    expiryText: "این کد در 1 ساعت منقضی می‌شود",
    instructions: "این کد را در برنامه VitaLink وارد کنید تا تأیید خود را تکمیل کنید. اگر این کد را درخواست نکرده‌اید، لطفاً این ایمیل را نادیده بگیرید.",
    securityIcon: "🔒",
    securityText: "نکته امنیتی: هرگز این کد را با کسی به اشتراک نگذارید. کارکنان VitaLink هرگز کد تأیید شما را درخواست نخواهند کرد.",
    tagline: "سلامت خانواده شما، همیشه در دسترس",
    taglineSub: "اتصال خانواده‌ها به سلامت، در سطح جهانی.",
    visitWebsite: "بازدید از وب‌سایت",
    support: "پشتیبانی",
    footerText: "این ایمیل به ارسال شد",
    direction: "rtl"
  },
  ur: {
    title: "آپ کا VitaLink تصدیقی کوڈ",
    headerText: "اپنا ای میل تصدیق کریں",
    greeting: "ہیلو!",
    welcomeMessage: "<strong>VitaLink</strong> میں خوش آمدید! ہم آپ کے ساتھ شامل ہونے پر بہت پرجوش ہیں تاکہ آپ اپنی صحت کو ٹریک کریں اور اپنے پیاروں سے جڑے رہیں۔",
    codeLabel: "آپ کا تصدیقی کوڈ",
    expiryText: "یہ کوڈ 1 گھنٹے میں ختم ہو جاتا ہے",
    instructions: "اپنی تصدیق مکمل کرنے کے لیے VitaLink ایپ میں یہ کوڈ درج کریں۔ اگر آپ نے یہ کوڈ درخواست نہیں کیا، براہ کرم اس ای میل کو نظر انداز کریں۔",
    securityIcon: "🔒",
    securityText: "سیکیورٹی ٹپ: یہ کوڈ کبھی بھی کسی کے ساتھ شیئر نہ کریں۔ VitaLink عملہ آپ سے کبھی بھی آپ کا تصدیقی کوڈ نہیں مانگے گا۔",
    tagline: "آپ کے خاندان کی صحت، ہمیشہ پہنچ میں",
    taglineSub: "خاندانوں کو صحت سے جوڑنا، عالمی سطح پر۔",
    visitWebsite: "ویب سائٹ ملاحظہ کریں",
    support: "سپورٹ",
    footerText: "یہ ای میل بھیجا گیا",
    direction: "rtl"
  },
  zh: {
    title: "您的 VitaLink 验证码",
    headerText: "验证您的邮箱",
    greeting: "您好！",
    welcomeMessage: "欢迎使用 <strong>VitaLink</strong>！我们很高兴您加入我们，一起追踪您的健康状况并与您所爱的人保持联系。",
    codeLabel: "您的验证码",
    expiryText: "此验证码将在1小时后过期",
    instructions: "请在 VitaLink 应用中输入此验证码以完成验证。如果您没有请求此验证码，请忽略此邮件。",
    securityIcon: "🔒",
    securityText: "安全提示：切勿与任何人分享此验证码。VitaLink 工作人员绝不会向您索要验证码。",
    tagline: "您家人的健康，触手可及",
    taglineSub: "连接全球家庭与健康。",
    visitWebsite: "访问网站",
    support: "支持",
    footerText: "此邮件已发送至",
    direction: "ltr"
  },
  ja: {
    title: "VitaLink認証コード",
    headerText: "メールを確認",
    greeting: "こんにちは！",
    welcomeMessage: "<strong>VitaLink</strong>へようこそ！健康を追跡し、大切な人々とつながり続けるためにご参加いただき、大変嬉しく思います。",
    codeLabel: "認証コード",
    expiryText: "このコードは1時間で期限切れになります",
    instructions: "VitaLinkアプリでこのコードを入力して、認証を完了してください。このコードをリクエストしていない場合は、このメールを無視してください。",
    securityIcon: "🔒",
    securityText: "セキュリティのヒント：このコードを誰とも共有しないでください。VitaLinkスタッフが認証コードを尋ねることはありません。",
    tagline: "ご家族の健康、常に手の届くところに",
    taglineSub: "世界中の家族を健康につなぐ。",
    visitWebsite: "ウェブサイトを訪問",
    support: "サポート",
    footerText: "このメールはに送信されました",
    direction: "ltr"
  }
}

// Generate email HTML template
function generateEmailHTML(lang: string, token: string, email: string): string {
  const t = translations[lang] || translations.en
  
  return `<!DOCTYPE html>
<html lang="${lang}" dir="${t.direction}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${t.title}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%);
            padding: 40px 20px;
            min-height: 100vh;
        }
        .email-container {
            max-width: 600px;
            margin: 0 auto;
            background: #ffffff;
            border-radius: 24px;
            overflow: hidden;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        }
        .email-header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 40px 30px;
            text-align: center;
            position: relative;
            overflow: hidden;
        }
        .email-header::before {
            content: '';
            position: absolute;
            top: -50%;
            left: -50%;
            width: 200%;
            height: 200%;
            background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%);
        }
        .logo {
            width: 80px;
            height: 80px;
            margin: 0 auto 20px;
            background: rgba(255, 255, 255, 0.2);
            border-radius: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            backdrop-filter: blur(10px);
            border: 2px solid rgba(255, 255, 255, 0.3);
            position: relative;
            z-index: 1;
        }
        .logo-text {
            font-size: 32px;
            font-weight: 700;
            color: white;
        }
        .email-header h1 {
            color: white;
            font-size: 28px;
            font-weight: 700;
            margin: 0;
            position: relative;
            z-index: 1;
        }
        .email-body {
            padding: 40px 30px;
        }
        .greeting {
            font-size: 18px;
            color: #1a202c;
            margin-bottom: 20px;
            line-height: 1.6;
        }
        .code-container {
            background: linear-gradient(135deg, #f0f4ff 0%, #ffffff 100%);
            border: 2px solid #e5e7eb;
            border-radius: 16px;
            padding: 30px;
            text-align: center;
            margin: 30px 0;
        }
        .code-label {
            font-size: 14px;
            color: #718096;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 15px;
            font-weight: 600;
        }
        .code {
            font-size: 42px;
            font-weight: 700;
            color: #667eea;
            letter-spacing: 8px;
            font-family: 'Courier New', monospace;
            margin: 10px 0;
            text-shadow: 0 2px 4px rgba(102, 126, 234, 0.2);
        }
        .code-expiry {
            font-size: 14px;
            color: #718096;
            margin-top: 15px;
        }
        .message {
            font-size: 16px;
            color: #4a5568;
            line-height: 1.7;
            margin: 20px 0;
        }
        .security-note {
            background: #fef3c7;
            border-${t.direction === 'rtl' ? 'right' : 'left'}: 4px solid #f59e0b;
            padding: 15px 20px;
            border-radius: 8px;
            margin: 25px 0;
        }
        .security-note p {
            font-size: 14px;
            color: #92400e;
            margin: 0;
            line-height: 1.6;
        }
        .footer {
            background: #f7fafc;
            padding: 30px;
            text-align: center;
            border-top: 1px solid #e5e7eb;
        }
        .footer p {
            font-size: 14px;
            color: #718096;
            margin: 8px 0;
            line-height: 1.6;
        }
        .footer-links {
            margin-top: 20px;
        }
        .footer-links a {
            color: #667eea;
            text-decoration: none;
            margin: 0 10px;
            font-size: 14px;
        }
        [dir="rtl"] {
            direction: rtl;
            text-align: right;
        }
        @media only screen and (max-width: 600px) {
            .email-container { border-radius: 0; }
            .email-header, .email-body, .footer { padding: 30px 20px; }
            .code { font-size: 36px; letter-spacing: 6px; }
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="email-header">
            <div class="logo">
                <div class="logo-text">VL</div>
            </div>
            <h1>${t.headerText}</h1>
        </div>
        <div class="email-body">
            <p class="greeting">${t.greeting}</p>
            <p class="message">${t.welcomeMessage}</p>
            <div class="code-container">
                <div class="code-label">${t.codeLabel}</div>
                <div class="code">${token}</div>
                <div class="code-expiry">${t.expiryText}</div>
            </div>
            <p class="message">${t.instructions}</p>
            <div class="security-note">
                <p><strong>${t.securityIcon} ${t.securityText}</strong></p>
            </div>
        </div>
        <div class="footer">
            <p><strong>VitaLink</strong> - ${t.tagline}</p>
            <p>${t.taglineSub}</p>
            <div class="footer-links">
                <a href="https://vitalink.app">${t.visitWebsite}</a>
                <a href="https://vitalink.app/support">${t.support}</a>
            </div>
            <p style="margin-top: 20px; font-size: 12px; color: #a0aec0;">
                ${t.footerText} ${email}. ${t.direction === 'rtl' ? 'إذا لم تطلب هذا، يمكنك تجاهله بأمان.' : 'If you didn\'t request this, you can safely ignore it.'}
            </p>
        </div>
    </div>
</body>
</html>`
}

serve(async (req) => {
  try {
    const { email, token, language = 'en' } = await req.json()
    
    const html = generateEmailHTML(language, token, email)
    
    return new Response(JSON.stringify({ html }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }
})

