# Security Audit - Flick Web

**Date:** 2026-03-30
**Scope:** Full codebase audit (OWASP Top 10)

---

## Findings Summary

| Severity | Count | Fixed |
|----------|-------|-------|
| Critical | 4     | 4     |
| High     | 6     | 4     |
| Medium   | 7     | 1     |
| Low/Info | 2     | 0     |

---

## Critical — Fixed

### 1. DOM-Based XSS — Contributors grid (github.ts)
`c.login`, `c.html_url`, and `c.avatar_url` from GitHub API were injected
into `innerHTML` without escaping. Attacker-controlled contributor names or
URLs could execute arbitrary scripts.

**Fix:** All contributor fields are now escaped with `escapeHtml()` and
validated with `isGitHubUrl()` before injection.

### 2. Markdown-to-HTML XSS — Release notes (github.ts)
`formatInlineMarkdown()` used simple regex substitution (`$2`) to insert URLs
into `<img src>` and `<a href>` attributes. Malicious URLs could bypass the
`https?://` prefix check or inject attribute-breaking content.

**Fix:** Replaced static `$2` replacements with callback functions that
validate each URL through `isHttpsUrl()`. Invalid URLs are stripped.

### 3. Query String Injection — GitHub proxy (github-proxy.ts)
The `qs` parameter was appended verbatim to the upstream GitHub API URL,
allowing arbitrary query parameters (e.g. `per_page=999999`) or injection
of unintended API behavior.

**Fix:** Query string is now parsed and filtered through an allowlist
(`page`, `per_page` only). All other parameters are silently dropped.

### 4. Path Traversal — GitHub proxy regex (github-proxy.ts)
Path allowlist used `[^/]+` which accepts any non-slash character,
including URL-encoded sequences after `decodeURIComponent()`.

**Fix:** Tightened regex to `[a-zA-Z0-9_.-]+` for owner/repo segments.
Added double-encoding rejection check.

---

## High — Fixed

### 5. Missing Security Headers
No `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, or
`Permissions-Policy` headers were configured.

**Fix:** Added `vercel.json` with DENY framing, nosniff, strict referrer,
and restrictive permissions policy.

### 6. Unvalidated Download URLs
`browser_download_url` from GitHub API was used directly without validating
it pointed to a GitHub domain. Could enable phishing via hijacked API data.

**Fix:** `getReleaseDownloadUrl()` now validates URLs with `isGitHubUrl()`
and falls back to the constructed GitHub releases page URL.

### 7. Unvalidated release `html_url`
`release.html_url` was used directly in the "View on GitHub" link.

**Fix:** Now validated with `isGitHubUrl()` before use, falls back to
the constructed releases page URL.

### 8. No Request Timeout on Proxy
The proxy had no timeout on upstream `fetch()`, allowing hanging connections.

**Fix:** Added 8-second `AbortController` timeout on all proxy requests.

---

## High — Remaining (recommendations)

### 9. No Rate Limiting on Proxy
The `/api/github-proxy` endpoint has no request throttling. Could be
abused to exhaust GitHub API quotas or perform amplification attacks.

**Recommendation:** Add Vercel Edge rate limiting or Upstash-based
sliding window limiter (100 req/min per IP).

### 10. localStorage Accessible via XSS
Cached API responses and download timestamps in `localStorage` are
readable by any script on the page if XSS occurs.

**Recommendation:** Consider `sessionStorage` for cache data. Add
Content Security Policy when inline script requirements are resolved.

---

## Medium — Remaining (recommendations)

### 11. No Content Security Policy (CSP)
CSP was not added because the app uses inline styles via Tailwind.
Adding CSP with `style-src 'unsafe-inline'` offers limited protection.

**Recommendation:** Evaluate extracting critical CSS at build time to
enable a strict CSP policy.

### 12. External Font Without SRI
Google Fonts CSS is imported without Subresource Integrity.

### 13. No `package-lock.json` in Repository
Dependency versions use `^` ranges; builds are non-deterministic.

**Recommendation:** Commit lock file and use `npm ci` in CI/CD.

### 14. No Analytics Consent for Download Tracking
Download click timestamps stored in `localStorage` without user consent.

### 15. Missing CORS Restriction on Proxy
Proxy relies on Vercel's default CORS behavior rather than explicit
`Access-Control-Allow-Origin` restriction.

### 16. No Error Monitoring
Silent `catch {}` blocks throughout — no incident detection capability.

### 17. Route Hash Matching Too Loose
`getCurrentRoute()` used `.includes("release-notes")` instead of exact match.

**Fix:** Changed to exact match on `hash === "release-notes"`.

---

## Positive Practices Already in Place

- `escapeHtml()` function for HTML entity encoding
- GET-only restriction on proxy endpoint
- Path allowlist on proxy (regex-based)
- `rel="noopener"` on all external links
- API response caching with TTL to reduce exposure
- Server-side token (not exposed in client bundle)
- TypeScript strict mode enabled
