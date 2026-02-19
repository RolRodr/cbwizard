// --- Constants ---
export const DB_NAME = 'GitHubWizardDB';
export const DB_VERSION = 1;
export const STORE_FILES = 'files'; // For CSV and Images

export const STATE = {
    token: null,
    user: null, // { login: "username", ... }
    templateRepo: "CollectionBuilder/collectionbuilder-gh", // Hardcoded default
    targetRepo: null, // "username/repo"
    csvFile: null, // { name, type, content, path }
    mediaFiles: [], // [{ name, type, content (base64), path }]
    currentStep: 0,
    maxStep: 0
};
