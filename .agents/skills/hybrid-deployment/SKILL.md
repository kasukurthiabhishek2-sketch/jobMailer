---
name: hybrid-deployment
description: Guide for managing and troubleshooting hybrid deployments (Vercel frontend + Render backend) for JDMail, including CORS origin normalization, environment variable management, and MCP server connectivity. Activate when deploying, configuring, or debugging Vercel/Render cloud infrastructure.
---

# Hybrid Deployment Guide (Vercel + Render)

This guide documents the architecture, configuration patterns, common pitfalls, and Model Context Protocol (MCP) integrations for running JDMail in a split cloud environment.

---

## 1. Architecture Topology

```
+------------------------------------+          +--------------------------------------+
|          Vercel (Client)           |  HTTPS   |            Render (Server)           |
|  - Vite React SPA                  | -------> |  - Node.js / Express API             |
|  - URL: job-mailer-ruddy.vercel.app|          |  - URL: jobmailer-8q38.onrender.com  |
|  - Env: VITE_API_URL (build-time)  |          |  - Env: ALLOWED_ORIGINS (runtime)    |
+------------------------------------+          +--------------------------------------+
                  \                                    /
                   \                                  /
                    v                                v
                     Firebase Auth & Firestore Rules
                     - Client: Direct auth & user outreach logs
                     - Server: ID token verification (stateless)
```

---

## 2. CORS & Origin Normalization Pitfalls

### The Trailing Slash Rule
Per the W3C Origin Specification, web browsers (Chrome, Firefox, Safari) **never** append a trailing slash to the `Origin` header:
- **Browser sends:** `Origin: https://job-mailer-ruddy.vercel.app`
- **User may configure:** `ALLOWED_ORIGINS=https://job-mailer-ruddy.vercel.app/` (with trailing slash)

### Failure Symptom:
A naive string comparison (`customAllowed.includes(origin)`) fails. The server returns:
```
HTTP/2 500 {"success":false,"error":"CORS policy: Origin not permitted"}
```
In the browser, this manifests as:
```
TypeError: Failed to fetch
```

### Rule of Implementation:
Always normalize origins by stripping trailing slashes in both the configured origins and incoming request origins:
```javascript
const cleanOrigin = origin.replace(/\/+$/, '');
const customAllowed = process.env.ALLOWED_ORIGINS.split(',')
  .map(s => s.trim().replace(/\/+$/, ''))
  .filter(Boolean);
```

---

## 3. Environment Variable Invariants

| Platform | Variable | Expected Format | Critical Notes |
| :--- | :--- | :--- | :--- |
| **Vercel** | `VITE_API_URL` | `https://jobmailer-8q38.onrender.com` | No trailing slash. Baked at build time. Trigger redeploy after setting. |
| **Render** | `ALLOWED_ORIGINS` | `https://job-mailer-ruddy.vercel.app` | Comma-separated if multiple. No trailing slashes. |
| **Render** | `NODE_ENV` | `production` | Enforces production security checks. |
| **Render** | `FIREBASE_PROJECT_ID`| `outreach-d565d` | For token verification. |
| **Render** | `ENCRYPTION_MASTER_KEY`| Auto-generated 32-byte hex | Render generates automatically on first deploy. |

---

## 4. MCP Servers Configuration

Antigravity IDE discovers and connects to MCP servers defined in `.agents/mcp_config.json`:

```json
{
  "mcpServers": {
    "render": {
      "serverUrl": "https://mcp.render.com/mcp"
    },
    "vercel": {
      "serverUrl": "https://mcp.vercel.com"
    }
  }
}
```

### Managing in Antigravity IDE:
1. Open the **Agent** panel in the IDE.
2. Click the **"..."** menu (top right).
3. Select **Manage MCP Servers** to view connection status and authenticate via OAuth or API tokens.

---

## 5. Verification Commands

To diagnose cross-origin or connectivity issues between deployments:
```bash
# 1. Verify Render health endpoint
curl -I https://jobmailer-8q38.onrender.com/api/health

# 2. Test preflight OPTIONS request with exact browser headers
curl -i -X OPTIONS https://jobmailer-8q38.onrender.com/api/config/smtp/test \
  -H "Origin: https://job-mailer-ruddy.vercel.app" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type,Authorization"

# 3. Check Vercel build output bundle for backend URL
curl -s https://job-mailer-ruddy.vercel.app/assets/*.js | grep "onrender.com"
```
