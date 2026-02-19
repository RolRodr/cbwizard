// --- DOM Elements ---
// Elements are accessed lazily via getters so they are queried after DOMContentLoaded.

export function getSteps() {
    return [
        document.getElementById('step-0'), // Welcome
        document.getElementById('step-1'), // Connect (was 0)
        document.getElementById('step-2'), // Fork (was 1)
        document.getElementById('step-3'), // CSV (was 2)
        document.getElementById('step-4'), // Images (was 3)
        document.getElementById('step-5'), // Adjust Configuration (was 4)
        document.getElementById('step-6')  // Success (was 5)
    ];
}

export const elements = {
    // Step 0
    get startBtn() { return document.getElementById('start-btn'); },

    // Step 1: Connect
    get authForm() { return document.getElementById('auth-form'); },
    get tokenInput() { return document.getElementById('github-token'); },
    get connectBtn() { return document.getElementById('connect-btn'); },

    // User Confirmation / Profile
    get userConfirmation() { return document.getElementById('user-confirmation'); },
    get userAvatar() { return document.getElementById('user-avatar'); },
    get confirmDisplayname() { return document.getElementById('confirm-displayname'); },
    get confirmUsername() { return document.getElementById('confirm-username'); },
    get confirmBio() { return document.getElementById('confirm-bio'); },
    get confirmRepos() { return document.getElementById('confirm-repos'); },
    get confirmUserBtn() { return document.getElementById('confirm-user-btn'); },
    get cancelUserBtn() { return document.getElementById('cancel-user-btn'); },

    get userInfo() { return document.getElementById('user-info'); },
    get username() { return document.getElementById('username'); },
    get logoutBtn() { return document.getElementById('logout-btn'); },
    get globalError() { return document.getElementById('global-error'); },

    // Step 2: Fork
    get forkForm() { return document.getElementById('fork-form'); },
    get templateRepoInput() { return document.getElementById('template-repo'); },
    get newRepoNameInput() { return document.getElementById('new-repo-name'); },
    get forkStatus() { return document.getElementById('fork-status'); },
    get forkBtn() { return document.getElementById('fork-btn'); },

    // Existing Fork UI
    get forkOptionsContainer() { return document.getElementById('fork-options-container'); },
    get showExistingReposBtn() { return document.getElementById('show-existing-repos-btn'); },
    get existingReposContainer() { return document.getElementById('existing-repos-container'); },
    get backToForkBtn() { return document.getElementById('back-to-fork-btn'); },
    get reposLoading() { return document.getElementById('repos-loading'); },
    get reposError() { return document.getElementById('repos-error'); },
    get reposList() { return document.getElementById('repos-list'); },

    // Step 2 Success
    get step2Success() { return document.getElementById('step-2-success'); },
    get selectedRepoName() { return document.getElementById('selected-repo-name'); },
    get repoFileTreeContainer() { return document.getElementById('repo-file-tree-container'); },
    get repoFileTree() { return document.getElementById('repo-file-tree'); },
    get newRepoLink() { return document.getElementById('new-repo-link'); },
    get step2Next() { return document.getElementById('step-2-next'); },

    // Step 3: CSV
    get csvInput() { return document.getElementById('csv-file'); },
    get csvPreview() { return document.getElementById('csv-preview'); },
    get csvTable() { return document.getElementById('csv-table'); },
    get csvUploadControls() { return document.getElementById('csv-upload-controls'); },
    get csvFilenameInput() { return document.getElementById('csv-filename'); },
    get step3Next() { return document.getElementById('step-3-next'); },

    // Step 4: Media Files
    get imageInput() { return document.getElementById('image-files'); },
    get imagePreview() { return document.getElementById('image-preview'); },
    get step4Next() { return document.getElementById('step-4-next'); },
    get step4Skip() { return document.getElementById('step-4-skip'); },

    // Step 5: Configure & Publish
    get publishBtn() { return document.getElementById('publish-btn'); },
    get configTitle() { return document.getElementById('config-title'); },
    get configTagline() { return document.getElementById('config-tagline'); },
    get configDescription() { return document.getElementById('config-description'); },
    get configMetadata() { return document.getElementById('config-metadata'); },
    get configFeaturedImage() { return document.getElementById('config-featured-image'); },
    get featuredImagePreview() { return document.getElementById('featured-image-preview'); },
    get publishProgress() { return document.getElementById('publish-progress'); },
    get publishProgressLabel() { return document.getElementById('publish-progress-label'); },
    get publishProgressFill() { return document.getElementById('publish-progress-fill'); },
    get publishSummaryList() { return document.getElementById('publish-summary-list'); },

    // Step 6: Published
    get publishLinks() { return document.getElementById('publish-links'); },
    get resetBtn() { return document.getElementById('reset-app-btn'); },

    // Layout
    get appLayout() { return document.getElementById('app-layout'); },

    // Sidebar navigation
    get stepNav() { return document.getElementById('step-nav'); },
    get navItems() { return Array.from(document.querySelectorAll('#step-nav li')); },

    // Step 3 demo CSV preview
    get demoCsvLoading() { return document.getElementById('demo-csv-loading'); },
    get demoCsvError() { return document.getElementById('demo-csv-error'); },
    get demoCsvTableWrap() { return document.getElementById('demo-csv-table-wrap'); },
    get demoCsvTable() { return document.getElementById('demo-csv-table'); }
};
