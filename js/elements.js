// --- DOM Elements ---
// Elements are accessed lazily via getters so they are queried after DOMContentLoaded.

/** Returns an array of all wizard step DOM elements. */
export function getSteps() {
    return [
        document.getElementById('welcome-section'),
        document.getElementById('connect-section'),
        document.getElementById('fork-section'),
        document.getElementById('csv-section'),
        document.getElementById('media-section'),
        document.getElementById('publish-section'),
        document.getElementById('published-section')
    ];
}

export const ELEMENTS = {
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
    get userAvatarBtn() { return document.getElementById('user-avatar-btn'); },
    get topAvatar() { return document.getElementById('top-avatar'); },
    get userDropdown() { return document.getElementById('user-dropdown'); },
    get username() { return document.getElementById('username'); },
    get logoutBtn() { return document.getElementById('logout-btn'); },
    get globalError() { return document.getElementById('global-error'); },

    // Step 2: Fork / Choose Repository
    get repoChoicesContainer() { return document.getElementById('repo-choices-container'); },
    get choiceForkCsv() { return document.getElementById('choice-fork-csv'); },
    get choiceForkGh() { return document.getElementById('choice-fork-gh'); },
    get choiceModifyExisting() { return document.getElementById('choice-modify-existing'); },
    get backToChoicesBtn() { return document.getElementById('back-to-choices-btn'); },

    get forkOptionsContainer() { return document.getElementById('fork-options-container'); },
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

    // Repository Section Success
    get repositorySuccess() { return document.getElementById('step-2-success'); },
    get selectedRepoName() { return document.getElementById('selected-repo-name'); },
    get repoFileTreeContainer() { return document.getElementById('repo-file-tree-container'); },
    get repoFileTree() { return document.getElementById('repo-file-tree'); },
    get repoConfigContainer() { return document.getElementById('repo-config-container'); },
    get repoConfigContent() { return document.getElementById('repo-config-content'); },
    get newRepoLink() { return document.getElementById('new-repo-link'); },
    get changeRepoBtn() { return document.getElementById('change-repo-btn'); },
    get repositoryNext() { return document.getElementById('step-2-next'); },

    // Step 3: CSV Input and Status Card
    get step3InfoView() { return document.getElementById('step-3-info-view'); },
    get proceedToUploadBtn() { return document.getElementById('proceed-to-upload-btn'); },
    get step3UploadView() { return document.getElementById('step-3-upload-view'); },
    get backToInfoBtn() { return document.getElementById('back-to-info-btn'); },
    get csvUploadChoicesContainer() { return document.getElementById('csv-upload-choices-container'); },
    get choiceUploadCsv() { return document.getElementById('choice-upload-csv'); },
    get choiceRepoCsv() { return document.getElementById('choice-repo-csv'); },
    get choiceGoogleSheets() { return document.getElementById('choice-google-sheets'); },

    get uploadCsvSection() { return document.getElementById('upload-csv-section'); },
    get repoCsvPicker() { return document.getElementById('repo-csv-picker'); },
    get googleSheetsSection() { return document.getElementById('google-sheets-section'); },

    get backToUploadChoicesBtn1() { return document.getElementById('back-to-upload-choices-btn-1'); },
    get backToUploadChoicesBtn2() { return document.getElementById('back-to-upload-choices-btn-2'); },
    get backToUploadChoicesBtn3() { return document.getElementById('back-to-upload-choices-btn-3'); },

    get csvInput() { return document.getElementById('csv-file'); },
    get csvUploadControls() { return document.getElementById('csv-upload-controls'); },
    get csvFilenameInput() { return document.getElementById('csv-filename'); },
    get csvStatusFilename() { return document.getElementById('csv-status-filename'); },
    get csvStatusBadge() { return document.getElementById('csv-status-badge'); },
    get csvReviewBtn() { return document.getElementById('csv-review-btn'); },
    get step3Next() { return document.getElementById('step-3-next'); },
    // Step 3: Demo CSV Preview
    get demoCsvLoading() { return document.getElementById('demo-csv-loading'); },
    get demoCsvError() { return document.getElementById('demo-csv-error'); },
    get demoCsvTableWrap() { return document.getElementById('demo-csv-table-wrap'); },
    get demoCsvTable() { return document.getElementById('demo-csv-table'); },

    // CSV Validation Modal
    get csvModal() { return document.getElementById('csv-modal'); },
    get csvModalTable() { return document.getElementById('csv-modal-table'); },
    get csvModalSaveBtn() { return document.getElementById('csv-modal-save'); },
    get csvModalCancelBtn() { return document.getElementById('csv-modal-cancel'); },

    // Step 4: Media Files
    get imageInput() { return document.getElementById('image-files'); },
    get imagePreview() { return document.getElementById('image-preview'); },
    get step4Next() { return document.getElementById('step-4-next'); },
    get step4Skip() { return document.getElementById('step-4-skip'); },

    // Step 4: Derivatives
    get derivativesSection() { return document.getElementById('derivatives-section'); },
    get derivativesToggle() { return document.getElementById('derivatives-toggle'); },
    get derivativesStatus() { return document.getElementById('derivatives-status'); },

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
    get resetAppBtn() { return document.getElementById('reset-app-btn'); },

    // Layout
    get appLayout() { return document.getElementById('app-layout'); },

    // Sidebar navigation
    get stepNav() { return document.getElementById('step-nav'); },
    get navItems() { return Array.from(document.querySelectorAll('#step-nav li')); },

    // Global Loading Overlay
    get wizardLoadingTemplate() { return document.getElementById('wizard-loading-template'); },

    // Repo Sidebar
    get repoSidebar() { return document.getElementById('repo-sidebar'); },
    get sidebarRepoName() { return document.getElementById('sidebar-repo-name'); },
    get sidebarRepoLink() { return document.getElementById('sidebar-repo-link'); },
    get sidebarForkSource() { return document.getElementById('sidebar-fork-source'); },
    get sidebarConfigTitle() { return document.getElementById('sidebar-config-title'); },
    get sidebarConfigTagline() { return document.getElementById('sidebar-config-tagline'); },
    get sidebarConfigMetadata() { return document.getElementById('sidebar-config-metadata'); },
    get sidebarCsvStatus() { return document.getElementById('sidebar-csv-status'); },
    get sidebarCsvPreviewBtn() { return document.getElementById('sidebar-csv-preview-btn'); },
    get sidebarMediaCount() { return document.getElementById('sidebar-media-count'); },
    get sidebarPagesStatus() { return document.getElementById('sidebar-pages-status'); },

    // Global Modals
    get csvPreviewOverlay() { return document.getElementById('csv-preview-overlay'); },
    get csvPreviewClose() { return document.getElementById('csv-preview-close'); },
    get csvPreviewTableContainer() { return document.getElementById('csv-preview-table-container'); },
};
