import { STATE } from '../constants.js';
import { elements } from '../elements.js';
import { fetchUserRepos, getRepoReadme } from '../api.js';
import { updateUI, showError, renderRepoConfig } from '../ui.js';
import { saveState } from '../storage.js';
import { showWizardLoading, hideWizardLoading } from '../loading.js';

/** Registers event listeners for browsing and selecting existing repositories. */
export function registerExistingForkListeners() {
    if (elements.choiceModifyExisting) {
        elements.choiceModifyExisting.addEventListener('click', (e) => {
            e.preventDefault();
            showExistingRepos();
        });
    }

    if (elements.showExistingReposBtn) {
        elements.showExistingReposBtn.addEventListener('click', (e) => {
            e.preventDefault();
            showExistingRepos();
        });
    }

    if (elements.backToForkBtn) {
        elements.backToForkBtn.addEventListener('click', (e) => {
            e.preventDefault();
            showChoicesMenu();
        });
    }

    // Repos search/filter
    const searchInput = document.getElementById('repos-search');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            const query = searchInput.value.toLowerCase().trim();
            const items = document.querySelectorAll('#repos-list .repo-item');
            items.forEach(item => {
                const name = (item.querySelector('strong')?.textContent || '').toLowerCase();
                const desc = (item.querySelector('span')?.textContent || '').toLowerCase();
                item.style.display = (name.includes(query) || desc.includes(query)) ? '' : 'none';
            });
        });
    }
}

/** Shows the choices menu and hides the existing repos list and fork form. */
function showChoicesMenu() {
    if (elements.repoChoicesContainer) elements.repoChoicesContainer.classList.remove('hidden');
    if (elements.forkOptionsContainer) elements.forkOptionsContainer.classList.add('hidden');
    if (elements.existingReposContainer) elements.existingReposContainer.classList.add('hidden');

    // Explicitly hide success containers
    if (elements.step2Success) elements.step2Success.classList.add('hidden');
    if (elements.repoFileTreeContainer) elements.repoFileTreeContainer.classList.add('hidden');
    if (elements.repoConfigContainer) elements.repoConfigContainer.classList.add('hidden');
}

/** Shows the fork creation options and hides the existing repos list. */
function showForkOptions() {
    if (elements.repoChoicesContainer) elements.repoChoicesContainer.classList.add('hidden');
    if (elements.forkOptionsContainer) elements.forkOptionsContainer.classList.remove('hidden');
    if (elements.existingReposContainer) elements.existingReposContainer.classList.add('hidden');

    // Explicitly hide success containers
    if (elements.step2Success) elements.step2Success.classList.add('hidden');
    if (elements.repoFileTreeContainer) elements.repoFileTreeContainer.classList.add('hidden');
    if (elements.repoConfigContainer) elements.repoConfigContainer.classList.add('hidden');
}

/** Hides fork options and displays the existing repositories list. */
async function showExistingRepos() {
    if (elements.repoChoicesContainer) elements.repoChoicesContainer.classList.add('hidden');
    if (elements.forkOptionsContainer) elements.forkOptionsContainer.classList.add('hidden');
    if (elements.existingReposContainer) elements.existingReposContainer.classList.remove('hidden');

    // Explicitly hide success containers
    if (elements.step2Success) elements.step2Success.classList.add('hidden');
    if (elements.repoFileTreeContainer) elements.repoFileTreeContainer.classList.add('hidden');
    if (elements.repoConfigContainer) elements.repoConfigContainer.classList.add('hidden');

    // Load repos if not already loaded or if we want to refresh
    await loadRepos();
}

/** Fetches and renders the user's repositories into the repos list. */
async function loadRepos() {
    const listContainer = elements.reposList;
    const loadingObj = elements.reposLoading;
    const errorObj = elements.reposError;

    if (!listContainer) return;

    listContainer.innerHTML = '';
    showWizardLoading("The wizard is gazing into the crystal ball to find your repositories...");
    errorObj.classList.add('hidden');

    try {
        const repos = await fetchUserRepos(STATE.token);
        await hideWizardLoading();

        // Restore container visibility after loading finishes
        if (elements.existingReposContainer) elements.existingReposContainer.classList.remove('hidden');

        if (repos.length === 0) {
            errorObj.textContent = "No repositories found.";
            errorObj.classList.remove('hidden');
            return;
        }

        // Render repos
        // Filter? Maybe just show all for now, or client-side filter
        renderRepos(repos);

    } catch (err) {
        await hideWizardLoading();
        if (elements.existingReposContainer) elements.existingReposContainer.classList.remove('hidden');
        errorObj.textContent = `Error loading repositories: ${err.message}`;
        errorObj.classList.remove('hidden');
    }
}

/** Renders a list of repository items with click-to-select behavior. */
function renderRepos(repos) {
    const listContainer = elements.reposList;
    listContainer.innerHTML = '';

    repos.forEach(repo => {
        const item = document.createElement('div');
        item.className = 'repo-item';

        const title = document.createElement('strong');
        title.textContent = repo.name;

        const desc = document.createElement('span');
        desc.textContent = repo.description || '(no description)';
        desc.style.fontSize = '0.9em';
        desc.style.color = '#666';

        item.appendChild(title);
        item.appendChild(document.createElement('br'));
        item.appendChild(desc);

        item.addEventListener('click', () => selectRepo(repo));

        listContainer.appendChild(item);
    });
}

/** Validates a selected repo by checking its README for CollectionBuilder. */
async function selectRepo(repo) {
    console.log('selectRepo called for:', repo.full_name);
    // Validate repo - check README for "CollectionBuilder-CSV"
    const loadingObj = elements.reposLoading;
    const errorObj = elements.reposError;

    // Clear previous errors
    errorObj.classList.add('hidden');
    showWizardLoading(`The wizard is validating your repository: ${repo.name}...`);

    try {
        console.log('Fetching README for:', repo.name);
        const readmeData = await getRepoReadme(repo.owner.login, repo.name, STATE.token);

        // readmeData.content is base64 encoded
        if (!readmeData || !readmeData.content) {
            throw new Error("Could not fetch README.");
        }

        const content = atob(readmeData.content.replace(/\s/g, ''));
        console.log('README content length:', content.length);

        const lowerContent = content.toLowerCase();
        if (lowerContent.includes('collectionbuilder')) {
            console.log('Validation successful!');
            await hideWizardLoading();
            await handleValidRepo(repo);
        } else {
            console.warn('Validation failed: CollectionBuilder string not found in README');
            throw new Error("Repository does not appear to be a CollectionBuilder project (README check failed). The README must mention 'CollectionBuilder'.");
        }

    } catch (err) {
        console.error('Error in selectRepo:', err);
        await hideWizardLoading();
        if (elements.existingReposContainer) elements.existingReposContainer.classList.remove('hidden');
        errorObj.textContent = err.message;
        errorObj.classList.remove('hidden');
    }
}

/** Sets the validated repo as the target and shows the success view. */
async function handleValidRepo(repo) {
    console.log('handleValidRepo starting for:', repo.full_name);
    STATE.targetRepo = repo.full_name;
    STATE.isExistingRepo = true;
    localStorage.setItem('gh_wizard_target', repo.full_name);

    // We must call saveState to persist the isExistingRepo boolean correctly
    await saveState();

    // Update UI to show success
    if (elements.existingReposContainer) elements.existingReposContainer.classList.add('hidden');
    if (elements.forkOptionsContainer) elements.forkOptionsContainer.classList.add('hidden');

    if (elements.step2Success) {
        console.log('Showing success div and tree container');
        elements.step2Success.classList.remove('hidden');

        // Update Success Message
        if (elements.selectedRepoName) elements.selectedRepoName.textContent = repo.name;

        // Update Link
        if (elements.newRepoLink) elements.newRepoLink.href = repo.html_url;

        // Fetch and display repo configuration instead of file tree
        STATE.isExistingRepo = true;
        renderRepoConfig(repo.owner.login, repo.name);
    } else {
        console.error('CRITICAL: elements.step2Success NOT FOUND in DOM');
    }

    // Trigger the success state in UI
    console.log('Calling updateUI()');
    updateUI();
}
