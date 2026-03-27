import { STATE } from '../constants.js';
import { ELEMENTS } from '../elements.js';
import { saveState } from '../storage.js';
import { githubRequest } from '../api.js';
import { updateUI, showError } from '../ui.js';
import { showWizardLoading, hideWizardLoading } from '../loading.js';

/** Forks a template repo, renames it if needed, and updates app state. */
export async function handleFork(templateRepo, newName) {
    try {
        ELEMENTS.forkBtn.disabled = true;
        ELEMENTS.forkBtn.textContent = "Generating...";
        showWizardLoading(`Checking template repository...`);

        // 1. Verify template exists
        await githubRequest(`/repos/${templateRepo}`);

        STATE.templateRepo = templateRepo;

        // 2. Initiate template generation
        showWizardLoading(`The wizard is casting a spell to generate your new repository...`);
        let generateResult;
        try {
            generateResult = await githubRequest(`/repos/${templateRepo}/generate`, 'POST', {
                owner: STATE.user.login,
                name: newName,
                include_all_branches: false
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

        const owner = generateResult.owner.login;
        const createdName = generateResult.name;
        const finalHtmlUrl = generateResult.html_url;

        // 3. Poll until the generated repo is reachable
        showWizardLoading(`The wizard is waiting for GitHub to provision your repository...`);
        await pollForRepo(`${owner}/${createdName}`);

        STATE.targetRepo = `${owner}/${createdName}`;
        STATE.isExistingRepo = false;
        await saveState();

        await hideWizardLoading();
        ELEMENTS.forkStatus.classList.add('hidden');

        // Show success — hide form so fork button disappears
        ELEMENTS.forkForm.classList.add('hidden');
        ELEMENTS.newRepoLink.href = finalHtmlUrl;
        ELEMENTS.repositorySuccess.classList.remove('hidden');

    } catch (error) {
        showError(error.message || 'An unknown error occurred while generating the repository.');
        await hideWizardLoading();
        ELEMENTS.forkStatus.classList.add('hidden');
        if (ELEMENTS.forkForm) ELEMENTS.forkForm.classList.remove('hidden'); // explicitly restore the fork form on error
        // Re-enable on failure so user can retry
        ELEMENTS.forkBtn.disabled = false;
        ELEMENTS.forkBtn.textContent = "Fork Repository"; // Keeping the text generic or we could update it
    }
}

/** Polls the GitHub API until the forked repository is reachable. */
async function pollForRepo(repoFullName, attempts = 0) {
    const maxAttempts = 20; // up to ~60 seconds
    if (attempts >= maxAttempts) throw new Error("Timed out waiting for GitHub to provision the repository. Please try again.");

    try {
        showWizardLoading(`The wizard is waiting for GitHub to provision your repository... (attempt ${attempts + 1}/${maxAttempts})`);
        await githubRequest(`/repos/${repoFullName}`);
        return true;
    } catch (e) {
        await new Promise(r => setTimeout(r, 3000));
        return pollForRepo(repoFullName, attempts + 1);
    }
}

/** Displays a status message in the fork progress indicator. */
function showForkStatus(msg) {
    showWizardLoading(msg);
}

/** Registers event listeners for the fork form and step-2 next button. */
export function registerForkListeners() {
    // Repository Choices
    if (ELEMENTS.choiceForkCsv) {
        ELEMENTS.choiceForkCsv.addEventListener('click', () => {
            showForkForm('CollectionBuilder/collectionbuilder-csv');
        });
    }

    if (ELEMENTS.choiceForkGh) {
        ELEMENTS.choiceForkGh.addEventListener('click', () => {
            showForkForm('CollectionBuilder/collectionbuilder-gh');
        });
    }

    if (ELEMENTS.backToChoicesBtn) {
        ELEMENTS.backToChoicesBtn.addEventListener('click', () => {
            hideForkForm();
        });
    }

    ELEMENTS.forkForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const template = ELEMENTS.templateRepoInput.value.trim();
        const newName = ELEMENTS.newRepoNameInput.value.trim();

        if (!template || !newName) {
            showError("Please enter a valid repository name.");
            return;
        }

        await handleFork(template, newName);
    });

    ELEMENTS.repositoryNext.addEventListener('click', () => {
        STATE.currentStep = 3;
        STATE.maxStep = Math.max(STATE.maxStep, 3);
        updateUI();
    });

    if (ELEMENTS.changeRepoBtn) {
        ELEMENTS.changeRepoBtn.addEventListener('click', () => {
            // Reset repository selection
            STATE.targetRepo = null;
            STATE.isExistingRepo = false;
            localStorage.removeItem('gh_wizard_target');
            localStorage.removeItem('gh_wizard_is_existing');

            // Revert UI to choice menu
            if (ELEMENTS.repositorySuccess) ELEMENTS.repositorySuccess.classList.add('hidden');
            if (ELEMENTS.repoFileTreeContainer) ELEMENTS.repoFileTreeContainer.classList.add('hidden');
            if (ELEMENTS.repoConfigContainer) ELEMENTS.repoConfigContainer.classList.add('hidden');
            if (ELEMENTS.repoChoicesContainer) ELEMENTS.repoChoicesContainer.classList.remove('hidden');
        });
    }
}

/** Shows the fork form and pre-fills the template repository. */
function showForkForm(templateRepo) {
    if (ELEMENTS.repoChoicesContainer) ELEMENTS.repoChoicesContainer.classList.add('hidden');
    if (ELEMENTS.existingReposContainer) ELEMENTS.existingReposContainer.classList.add('hidden');
    if (ELEMENTS.forkOptionsContainer) ELEMENTS.forkOptionsContainer.classList.remove('hidden');

    // Ensure the actual form is visible (it gets hidden on successful fork in UI restore state)
    if (ELEMENTS.forkForm) ELEMENTS.forkForm.classList.remove('hidden');

    // Explicitly hide success containers
    if (ELEMENTS.repositorySuccess) ELEMENTS.repositorySuccess.classList.add('hidden');
    if (ELEMENTS.repoFileTreeContainer) ELEMENTS.repoFileTreeContainer.classList.add('hidden');
    if (ELEMENTS.repoConfigContainer) ELEMENTS.repoConfigContainer.classList.add('hidden');

    if (ELEMENTS.templateRepoInput) {
        ELEMENTS.templateRepoInput.value = templateRepo;
    }
}

/** Hides the fork form and shows the choices grid. */
function hideForkForm() {
    if (ELEMENTS.forkOptionsContainer) ELEMENTS.forkOptionsContainer.classList.add('hidden');
    if (ELEMENTS.existingReposContainer) ELEMENTS.existingReposContainer.classList.add('hidden');
    if (ELEMENTS.repoChoicesContainer) ELEMENTS.repoChoicesContainer.classList.remove('hidden');

    // Explicitly hide success containers
    if (ELEMENTS.step2Success) ELEMENTS.step2Success.classList.add('hidden');
    if (ELEMENTS.repoFileTreeContainer) ELEMENTS.repoFileTreeContainer.classList.add('hidden');
    if (ELEMENTS.repoConfigContainer) ELEMENTS.repoConfigContainer.classList.add('hidden');
}
