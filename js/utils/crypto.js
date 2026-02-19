/**
 * Token encryption utilities using Web Crypto API (AES-GCM).
 *
 * The PAT is encrypted before it touches localStorage so that:
 *  - Casual dev-tools inspection won't reveal the raw token
 *  - Automated scanners looking for `ghp_*` patterns won't match
 *  - Browser extensions that read localStorage see only ciphertext
 *
 * The encryption key is derived via PBKDF2 from the page origin and
 * a random salt stored alongside the ciphertext.  This is *not*
 * equivalent to a user-supplied passphrase — an attacker with full
 * JS execution on the same origin could replicate the derivation —
 * but it raises the bar significantly over plaintext storage.
 */

const ALGO   = 'AES-GCM';
const KEY_LEN    = 256;
const IV_LEN     = 12;   // 96-bit IV recommended for AES-GCM
const SALT_LEN   = 16;
const ITERATIONS = 100_000;

/**
 * Derive an AES-GCM key from the page origin + a random salt.
 */
async function deriveKey(salt) {
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(window.location.origin),
        'PBKDF2',
        false,
        ['deriveKey']
    );

    return crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
        keyMaterial,
        { name: ALGO, length: KEY_LEN },
        false,
        ['encrypt', 'decrypt']
    );
}

/**
 * Encrypt a plaintext token → Base-64 string  (salt ‖ iv ‖ ciphertext).
 */
export async function encryptToken(plaintext) {
    const salt = crypto.getRandomValues(new Uint8Array(SALT_LEN));
    const iv   = crypto.getRandomValues(new Uint8Array(IV_LEN));
    const key  = await deriveKey(salt);

    const cipherBuf = await crypto.subtle.encrypt(
        { name: ALGO, iv },
        key,
        new TextEncoder().encode(plaintext)
    );

    // Pack:  salt (16 B) + iv (12 B) + ciphertext
    const packed = new Uint8Array(SALT_LEN + IV_LEN + cipherBuf.byteLength);
    packed.set(salt, 0);
    packed.set(iv, SALT_LEN);
    packed.set(new Uint8Array(cipherBuf), SALT_LEN + IV_LEN);

    return btoa(String.fromCharCode(...packed));
}

/**
 * Decrypt a Base-64 blob back to the plaintext token.
 * Returns `null` if decryption fails (corrupt / wrong origin).
 */
export async function decryptToken(base64Blob) {
    try {
        const packed = Uint8Array.from(atob(base64Blob), c => c.charCodeAt(0));

        const salt       = packed.slice(0, SALT_LEN);
        const iv         = packed.slice(SALT_LEN, SALT_LEN + IV_LEN);
        const ciphertext = packed.slice(SALT_LEN + IV_LEN);

        const key = await deriveKey(salt);

        const plainBuf = await crypto.subtle.decrypt(
            { name: ALGO, iv },
            key,
            ciphertext
        );

        return new TextDecoder().decode(plainBuf);
    } catch {
        // Decryption failure — token was tampered with or origin changed
        console.warn('Token decryption failed; discarding stored token.');
        return null;
    }
}
