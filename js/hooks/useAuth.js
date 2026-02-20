import { STATE } from '../constants.js';
import { elements } from '../elements.js';
import { saveState, clearState } from '../storage.js';
import { githubRequest } from '../api.js';
import { updateUI, showError, clearError } from '../ui.js';

/** Validates the GitHub token, fetches user info, and updates app state. */
export async function authenticate(token, isRestoring = false) {
    try {
        elements.connectBtn.disabled = true;
        elements.connectBtn.textContent = "Verifying...";

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
                'Your token is missing the "repo" scope. Please generate a new token with the "repo" scope enabled.'
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
            elements.authForm.classList.add('hidden');
            elements.userAvatar.src = user.avatar_url;
            elements.userAvatar.alt = `${user.login}'s avatar`;
            elements.confirmDisplayname.textContent = user.name || user.login;
            elements.confirmUsername.textContent = `@${user.login}`;
            elements.confirmBio.textContent = user.bio || '';
            elements.confirmRepos.textContent = user.public_repos + (user.total_private_repos || 0);
            elements.userConfirmation.classList.remove('hidden');
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
        elements.connectBtn.disabled = false;
        elements.connectBtn.textContent = "Connect";
    }
}

/** Registers event listeners for login, confirm, cancel, and logout actions. */
export function registerAuthListeners() {
    elements.authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const token = elements.tokenInput.value.trim();
        if (!token) return;
        try {
            await authenticate(token);
        } catch (error) {
            showError(error.message);
        }
    });

    elements.confirmUserBtn.addEventListener('click', () => {
        STATE.currentStep = 2;
        updateUI();
    });

    elements.cancelUserBtn.addEventListener('click', () => {
        clearState();
        elements.userConfirmation.classList.add('hidden');
        elements.authForm.classList.remove('hidden');
        elements.tokenInput.value = '';
    });

    const logoutConfirm = document.getElementById('logout-confirm');
    const logoutYesBtn = document.getElementById('logout-yes-btn');
    const logoutNoBtn = document.getElementById('logout-no-btn');

    elements.logoutBtn.addEventListener('click', () => {
        elements.logoutBtn.classList.add('hidden');
        logoutConfirm.classList.remove('hidden');
        logoutYesBtn.focus();
    });

    logoutYesBtn.addEventListener('click', () => {
        clearState();
        location.reload();
    });

    logoutNoBtn.addEventListener('click', () => {
        logoutConfirm.classList.add('hidden');
        elements.logoutBtn.classList.remove('hidden');
        elements.logoutBtn.focus();
    });
}
