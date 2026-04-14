import { STATE } from '../constants.js';
import { ELEMENTS } from '../elements.js';
import { saveState, clearState } from '../storage.js';
import { githubRequest } from '../api.js';
import { updateUI, showError, clearError } from '../ui.js';

/** Validates the GitHub token, fetches user info, and updates app state. */
export async function authenticate(token, isRestoring = false) {
    try {
        ELEMENTS.connectBtn.disabled = true;
        ELEMENTS.connectBtn.textContent = "Verifying...";

        // Validate token by fetching user info — also check scopes
        const url = `https://api.github.com/user`;
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.message || `Authentication failed: ${response.status}`);
        }

        // Check X-OAuth-Scopes header for required 'repo' scope
        const scopes = response.headers.get('X-OAuth-Scopes') || '';
        const scopeList = scopes.split(',').map(s => s.trim().toLowerCase());
        if (!scopeList.includes('repo')) {
            throw new Error(
                'Your token is missing the "repo" scope. Please generate a new personal access token with the "repo" scope enabled.'
            );
        }

        const user = await response.json();
        STATE.token = token;
        STATE.user = user;
        await saveState();

        if (isRestoring && STATE.currentStep > 0) {
            // If restoring and already past step 0, just go there
            updateUI();
        } else {
            // Show confirmation profile card
            ELEMENTS.authForm.classList.add('hidden');
            ELEMENTS.userAvatar.src = user.avatar_url;
            ELEMENTS.userAvatar.alt = `${user.login}'s avatar`;
            ELEMENTS.confirmDisplayname.textContent = user.name || user.login;
            ELEMENTS.confirmUsername.textContent = `@${user.login}`;
            ELEMENTS.confirmBio.textContent = user.bio || '';
            ELEMENTS.confirmRepos.textContent = user.public_repos + (user.total_private_repos || 0);
            // Re-trigger animations by briefly removing and re-adding the animation classes
            const reveal = ELEMENTS.userConfirmation.querySelector('.user-confirm-reveal');
            if (reveal) {
                const animated = reveal.querySelectorAll(
                    '.user-confirm-identity, .user-confirm-question, .user-confirm-action-btn'
                );
                animated.forEach(el => {
                    el.style.animation = 'none';
                    void el.offsetWidth; // force reflow
                    el.style.animation = '';
                });
            }
            ELEMENTS.userConfirmation.classList.remove('hidden');
        }

        clearError();
    } catch (error) {
        if (isRestoring) {
            console.warn("Restore failed:", error);
            // Don't fully clear state on restore fail, just don't auto-login
        } else {
            throw error;
        }
    } finally {
        ELEMENTS.connectBtn.disabled = false;
        ELEMENTS.connectBtn.textContent = "Connect";
    }
}

/** Registers event listeners for login, confirm, cancel, and logout actions. */
export function registerAuthListeners() {
    ELEMENTS.authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const token = ELEMENTS.tokenInput.value.trim();
        if (!token) return;
        try {
            await authenticate(token);
        } catch (error) {
            showError(error.message);
        }
    });

    // Use event delegation on the stable #user-confirmation wrapper so that
    // animation re-triggers (which previously used cloneNode) don't orphan listeners.
    ELEMENTS.userConfirmation.addEventListener('click', (e) => {
        if (e.target.closest('#confirm-user-btn')) {
            STATE.currentStep = 2;
            STATE.maxStep = Math.max(STATE.maxStep, 2);
            updateUI();
        } else if (e.target.closest('#cancel-user-btn')) {
            clearState();
            ELEMENTS.userConfirmation.classList.add('hidden');
            ELEMENTS.authForm.classList.remove('hidden');
            ELEMENTS.tokenInput.value = '';
        }
    });

    const logoutConfirm = document.getElementById('logout-confirm');
    const logoutYesBtn = document.getElementById('logout-yes-btn');
    const logoutNoBtn = document.getElementById('logout-no-btn');

    if (ELEMENTS.userAvatarBtn) {
        ELEMENTS.userAvatarBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const dropdown = ELEMENTS.userDropdown;
            if (dropdown) {
                dropdown.classList.toggle('hidden');
                const isExpanded = !dropdown.classList.contains('hidden');
                ELEMENTS.userAvatarBtn.setAttribute('aria-expanded', isExpanded);
                if (isExpanded && logoutConfirm) {
                    logoutConfirm.classList.add('hidden');
                }
            }
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (ELEMENTS.userDropdown && !ELEMENTS.userDropdown.classList.contains('hidden')) {
                if (!ELEMENTS.userDropdown.contains(e.target) && !ELEMENTS.userAvatarBtn.contains(e.target)) {
                    ELEMENTS.userDropdown.classList.add('hidden');
                    ELEMENTS.userAvatarBtn.setAttribute('aria-expanded', 'false');
                }
            }
        });
    }

    if (ELEMENTS.logoutBtn) {
        ELEMENTS.logoutBtn.addEventListener('click', () => {
            if (ELEMENTS.userDropdown) ELEMENTS.userDropdown.classList.add('hidden');
            if (ELEMENTS.userAvatarBtn) ELEMENTS.userAvatarBtn.setAttribute('aria-expanded', 'false');
            if (logoutConfirm) {
                logoutConfirm.classList.remove('hidden');
                if (logoutYesBtn) logoutYesBtn.focus();
            }
        });
    }

    logoutYesBtn.addEventListener('click', () => {
        clearState();
        location.reload();
    });

    if (logoutNoBtn) {
        logoutNoBtn.addEventListener('click', () => {
            if (logoutConfirm) logoutConfirm.classList.add('hidden');
            if (ELEMENTS.userAvatarBtn) ELEMENTS.userAvatarBtn.focus();
        });
    }
}
