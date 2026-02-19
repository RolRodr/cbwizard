# Privacy & Security Measures

CollectionBuilder Wizard is a **fully client-side** web application. All processing happens directly in your browser — no data is ever sent to, or stored on, a third-party server controlled by this project.

---

## 1. No Backend Server

The application is a static site composed of HTML, CSS, and JavaScript. There is **no application server, database, or analytics service** collecting your data. The only external network requests are made directly from your browser to the **GitHub API** (`api.github.com`) using your Personal Access Token.

## 2. Data Storage — Browser Only

| Data | Storage Location | Details |
|---|---|---|
| GitHub Personal Access Token | `localStorage` (encrypted) | AES-256-GCM encrypted before storage (see §3) |
| Template / target repo names | `localStorage` | Stored as plain strings |
| CSV metadata file | IndexedDB (`GitHubWizardDB`) | Stays in your browser |
| Media / image files | IndexedDB (`GitHubWizardDB`) | Stays in your browser |

All data lives exclusively in your browser's local storage and IndexedDB. Nothing is transmitted anywhere except to GitHub's API when you explicitly take an action (authenticate, fork, upload, publish).

## 3. Token Encryption (AES-256-GCM)

Your GitHub Personal Access Token is **never stored as plaintext**. Before being written to `localStorage`, it is encrypted using the **Web Crypto API**:

- **Algorithm:** AES-GCM with a 256-bit key
- **Key derivation:** PBKDF2 with 100,000 iterations and SHA-256, seeded from the page origin and a cryptographically random 16-byte salt
- **Initialization vector:** A fresh random 96-bit IV is generated for every save, so the ciphertext changes each time
- **Tamper detection:** AES-GCM is an authenticated encryption scheme — any modification to the stored ciphertext will cause decryption to fail, at which point the token is automatically discarded

This means:
- Inspecting `localStorage` in browser DevTools shows only an opaque Base64 blob, not a raw `ghp_*` token
- Automated scanners or browser extensions looking for token patterns will not find a match
- A `localStorage` export copied to a different origin will not decrypt successfully

## 4. Content Security Policy (CSP)

A strict Content Security Policy is enforced via a `<meta>` tag to mitigate cross-site scripting (XSS) attacks:

| Directive | Value | Purpose |
|---|---|---|
| `default-src` | `'self'` | Only allow resources from the same origin |
| `script-src` | `'self'` | Block all inline scripts and scripts from other origins |
| `style-src` | `'self'` | Block injected stylesheets |
| `img-src` | `'self' https://avatars.githubusercontent.com` | Only allow local images and GitHub avatars |
| `connect-src` | `'self' https://api.github.com https://raw.githubusercontent.com` | Restrict network requests to GitHub API only |
| `object-src` | `'none'` | Block Flash, Java, and other plugin content |
| `base-uri` | `'self'` | Prevent `<base>` tag hijacking |
| `form-action` | `'self'` | Prevent forms from submitting to external URLs |

This policy ensures that even if an attacker managed to inject HTML into the page, the browser would refuse to execute unauthorized scripts or exfiltrate data to external servers.

## 5. Minimal Token Scope

The application requests only the **`repo`** scope from your GitHub token — the minimum required to fork a repository and push content. It validates the scope on login and rejects tokens that don't include it, preventing accidental use of overly-permissive tokens.

## 6. Logout & Data Clearing

When you log out:
- `localStorage` is fully cleared (encrypted token, repo names, and all keys)
- IndexedDB (`GitHubWizardDB`) is wiped (CSV and media files)
- All in-memory state (`STATE.token`, `STATE.user`, file references) is reset to `null`

No residual data remains in the browser after logout.

## 7. Secure Input Handling

- The token input field uses `type="password"` so the PAT is masked in the UI at all times
- External links use `rel="noopener noreferrer"` to prevent tab-napping
- The token is transmitted to GitHub over HTTPS exclusively — the CSP `connect-src` directive enforces this

