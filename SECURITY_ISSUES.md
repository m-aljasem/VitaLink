# Security Issues and Recommendations

## 🔴 CRITICAL Issues

### 1. Hardcoded API Keys in Source Code
**Location:** `src/environments/environment.ts` and `src/environments/environment.prod.ts`

**Issue:** The Supabase anon key is hardcoded in the source code files. This is a major security risk because:
- These files are likely committed to version control
- Anyone with access to the repository can see the API key
- The key is exposed in the client-side bundle

**Impact:** High - API keys should never be in source code

**Fix:** 
- Remove hardcoded keys from source files
- Use environment variables loaded at build time
- Ensure `.env` files are in `.gitignore` (✅ already done)
- Use Angular's `fileReplacements` to inject environment variables during build

**Status:** ✅ Resolved. The anon key is public by design (RLS is the security layer); `environment*.ts` are now generated from `.env`/CI variables by `scripts/generate-env.js` and are no longer tracked in git.

---

### 2. Link Tokens Policy Allows Unauthenticated Access
**Location:** `supabase/schema.sql` line 149

**Issue:** The policy `"anyone can verify token"` allows unauthenticated users to query link tokens:
```sql
create policy "anyone can verify token" on public.link_tokens for select using (true);
```

**Impact:** Medium - Allows token enumeration attacks. Attackers could:
- Query all tokens in the system
- Attempt to brute force token codes
- See which providers have active tokens

**Fix:** Restrict token verification to authenticated users or use a more secure approach:
- Only allow token lookup by exact code match
- Add rate limiting at the application level
- Consider using a function that validates tokens server-side

**Status:** ✅ Resolved in `supabase/migrations/20261030_security_hardening.sql`. Codes are generated and redeemed only through `create_link_token()` / `redeem_link_token()`; only the issuing provider can read its tokens, codes are single-use and unique, and failed redemptions are limited to 10 per 15 minutes. The same migration removes direct inserts into `provider_links`, which previously let a provider recreate a revoked link with every metric shared.

---

## 🟡 Medium Priority Issues

### 3. Weak Email Validation
**Location:** `src/app/pages/auth/auth.page.ts` line 67

**Issue:** Email validation only checks if the string contains '@':
```typescript
if (!this.email || !this.email.includes('@')) {
```

**Impact:** Medium - Allows invalid email formats, could lead to:
- Failed OTP deliveries
- Poor user experience
- Potential for abuse

**Fix:** Use proper email validation:
- Use Angular's built-in email validator
- Or use a regex pattern for email validation
- Validate on both client and server side

**Status:** ✅ Resolved. `auth.page.ts` now validates with a full email pattern.

---

### 4. No Rate Limiting on OTP Requests
**Location:** `src/app/core/auth.service.ts`

**Issue:** No visible rate limiting on OTP (One-Time Password) requests. This could allow:
- Spam/abuse of the OTP system
- Email bombing attacks
- Resource exhaustion

**Impact:** Medium - Could lead to abuse and poor user experience

**Fix:** 
- Implement rate limiting (Supabase may have this built-in)
- Add client-side throttling
- Show appropriate error messages when rate limited

**Status:** ℹ️ Supabase Auth rate limits OTP emails per address and per IP (configurable under Authentication → Rate Limits).

---

### 5. Missing Input Validation on Profile Creation
**Location:** `src/app/pages/onboarding/onboarding.page.ts`

**Issue:** Some profile fields may not have proper validation:
- Age could be negative or unreasonably high
- Text fields could contain malicious content
- No length limits on text inputs

**Impact:** Low-Medium - Could lead to data quality issues

**Fix:**
- Add validation for all input fields
- Set reasonable limits on text field lengths
- Validate age ranges
- Sanitize user inputs

**Status:** 🟡 Partially resolved. The database now enforces age, height and text-length limits (see the migration). Client-side messages for these limits are still to do.

---

## ✅ Good Security Practices Already in Place

1. **Row Level Security (RLS) Policies** - ✅ Properly configured
   - Users can only access their own data
   - Provider-patient links are properly secured
   - Observations are protected by sharing permissions

2. **Authentication Guards** - ✅ Implemented
   - Routes are protected with `sessionGuard`
   - Unauthenticated users are redirected

3. **Environment Variables** - ✅ `.gitignore` properly configured
   - `.env` files are excluded from version control

4. **Cascade Deletes** - ✅ Database constraints properly set
   - User data is cleaned up when users are deleted

5. **Token Expiration** - ✅ Link tokens expire after 15 minutes

---

## Recommendations

1. **Immediate Actions:**
   - Remove hardcoded API keys from source files
   - Fix link_tokens RLS policy
   - Improve email validation

2. **Short-term Improvements:**
   - Add comprehensive input validation
   - Implement rate limiting checks
   - Add security headers (CSP, etc.)

3. **Long-term Enhancements:**
   - Regular security audits
   - Penetration testing
   - Security monitoring and logging
   - Consider adding 2FA for providers

---

## Notes

- The Supabase anon key is designed to be public (it's used client-side)
- However, it should still be in environment variables, not hardcoded
- RLS policies provide the actual security layer
- The service key should NEVER be exposed client-side (✅ not found in code)




