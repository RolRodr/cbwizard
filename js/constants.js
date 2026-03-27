// --- Constants ---
export const DB_NAME = 'CBWizardDB';
export const DB_VERSION = 1;
export const STORE_FILES = 'files'; // For CSV and Images

export const STATE = {
    token: null,
    user: null, // { login: "username", ... }
    templateRepo: "CollectionBuilder/collectionbuilder-gh", // Hardcoded default
    targetRepo: null, // "username/repo"
    isExistingRepo: false, // true if modifying an existing repository
    csvFile: null, // { name, type, content, path }
    googleSheetUrl: null, // Set when user chooses "Use Sheet Link" instead of uploading a CSV
    csvUploadedToRepo: false, // true after CSV has been committed to GitHub in Step 3
    mediaFiles: [], // [{ name, type, content (base64), path }]
    generateDerivatives: false, // Whether to generate small/thumb derivatives
    currentStep: 0,
    maxStep: 0
};
