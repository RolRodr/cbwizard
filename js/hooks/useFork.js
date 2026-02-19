import { STATE } from '../constants.js';
import { elements } from '../elements.js';
import { saveState } from '../storage.js';
import { githubRequest } from '../api.js';
import { updateUI, showError } from '../ui.js';

// --- Fork Logic ---
export async function handleFork(templateRepo, newName) {
    try {
        elements.forkBtn.disabled = true;
        elements.forkBtn.textContent = "Forking...";
        showForkStatus(`Checking template repository...`);

        // 1. Verify template exists
        await githubRequest(`/repos/${templateRepo}`);

        STATE.templateRepo = templateRepo;

        // 2. Initiate fork (name param works sometimes, but not reliably)
        showForkStatus(`Initiating fork...`);
        let forkResult;
        try {
            forkResult = await githubRequest(`/repos/${templateRepo}/forks`, 'POST', {
                name: newName,
                default_branch_only: true
            });
        } catch (err) {
            if (err.status === 422 || (err.message && err.message.toLowerCase().includes('already exists'))) {
                throw new Error(`A repository named "${newName}" already exists on your account. Please choose a different name.`);
            }
            if (err.status === 403 || (err.message && err.message.toLowerCase().includes('forbidden'))) {
                throw new Error(`Permission denied. Make sure your token has the "repo" scope enabled.`);
            }
            throw err;
        }

        // forkResult.full_name may use the original repo name if GitHub ignored our custom name
        const owner = forkResult.owner.login;
        const createdName = forkResult.name;

        // 3. Poll until the fork is reachable
        showForkStatus(`Waiting for GitHub to provision repository...`);
        await pollForRepo(`${owner}/${createdName}`);

        // 4. Rename if GitHub ignored our custom name
        let finalName = createdName;
        let finalHtmlUrl = forkResult.html_url;

        if (createdName !== newName) {
            showForkStatus(`Renaming repository to "${newName}"...`);
            try {
                const renamed = await githubRequest(`/repos/${owner}/${createdName}`, 'PATCH', { name: newName });
                finalName = renamed.name;
                finalHtmlUrl = renamed.html_url;
            } catch (renameErr) {
                if (renameErr.message && renameErr.message.toLowerCase().includes('already exists')) {
                    throw new Error(`Could not rename the fork: a repository named "${newName}" already exists on your account.`);
                }
                throw new Error(`Fork succeeded but renaming failed: ${renameErr.message}`);
            }

            // Wait briefly for rename to propagate, then verify
            await new Promise(r => setTimeout(r, 2000));
            await pollForRepo(`${owner}/${finalName}`);
        }

        STATE.targetRepo = `${owner}/${finalName}`;
        await saveState();

        showForkStatus(`Fork complete!`);
        elements.forkStatus.classList.add('hidden');

        // Show success — hide form so fork button disappears
        elements.forkForm.classList.add('hidden');
        elements.newRepoLink.href = finalHtmlUrl;
        elements.step2Success.classList.remove('hidden');

    } catch (error) {
        showError(error.message || 'An unknown error occurred while forking.');
        elements.forkStatus.classList.add('hidden');
        // Re-enable on failure so user can retry
        elements.forkBtn.disabled = false;
        elements.forkBtn.textContent = "Fork Repository";
    }
}

async function pollForRepo(repoFullName, attempts = 0) {
    const maxAttempts = 20; // up to ~60 seconds
    if (attempts >= maxAttempts) throw new Error("Timed out waiting for GitHub to provision the repository. Please try again.");

    try {
        showForkStatus(`Waiting for GitHub to provision repository... (attempt ${attempts + 1}/${maxAttempts})`);
        await githubRequest(`/repos/${repoFullName}`);
        return true;
    } catch (e) {
        await new Promise(r => setTimeout(r, 3000));
        return pollForRepo(repoFullName, attempts + 1);
    }
}

function showForkStatus(msg) {
    elements.forkStatus.textContent = msg;
    elements.forkStatus.classList.remove('hidden');
}

// --- Fork Event Listeners ---
export function registerForkListeners() {
    elements.forkForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const template = elements.templateRepoInput.value.trim();
        const newName = elements.newRepoNameInput.value.trim();

        if (!template || !newName) {
            showError("Please enter a valid repository name.");
            return;
        }

        await handleFork(template, newName);
    });

    elements.step2Next.addEventListener('click', () => {
        STATE.currentStep = 3;
        STATE.maxStep = Math.max(STATE.maxStep, 3);
        updateUI();
    });
}
