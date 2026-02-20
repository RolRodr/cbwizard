import { DB_NAME, DB_VERSION, STORE_FILES, STATE } from './constants.js';
import { encryptToken } from './utils/crypto.js';

// --- IndexedDB ---
export let db;

/** Opens (or creates) the IndexedDB database and sets up object stores. */
export function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = (event) => reject("IndexedDB error: " + event.target.error);

        request.onupgradeneeded = (event) => {
            db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_FILES)) {
                db.createObjectStore(STORE_FILES, { keyPath: 'id' });
            }
        };

        request.onsuccess = (event) => {
            db = event.target.result;
            resolve(db);
        };
    });
}

/** Saves a file record to the IndexedDB files store. */
export async function saveFileToDB(id, fileData) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction([STORE_FILES], 'readwrite');
        const store = tx.objectStore(STORE_FILES);
        const request = store.put({ id, ...fileData });

        request.onsuccess = () => resolve();
        request.onerror = (e) => reject(e.target.error);
    });
}

/** Retrieves all file records from the IndexedDB files store. */
export async function getAllFilesFromDB() {
    return new Promise((resolve, reject) => {
        const tx = db.transaction([STORE_FILES], 'readonly');
        const store = tx.objectStore(STORE_FILES);
        const request = store.getAll();

        request.onsuccess = () => resolve(request.result);
        request.onerror = (e) => reject(e.target.error);
    });
}

/** Deletes a file record from the IndexedDB files store by id. */
export async function deleteFileFromDB(id) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction([STORE_FILES], 'readwrite');
        const store = tx.objectStore(STORE_FILES);
        const request = store.delete(id);

        request.onsuccess = () => resolve();
        request.onerror = (e) => reject(e.target.error);
    });
}


// --- LocalStorage ---

/** Persists the current token, template, and target repo to localStorage. */
export async function saveState() {
    if (STATE.token) {
        const encrypted = await encryptToken(STATE.token);
        localStorage.setItem('gh_wizard_token', encrypted);
    }
    if (STATE.templateRepo) localStorage.setItem('gh_wizard_template', STATE.templateRepo);
    if (STATE.targetRepo) localStorage.setItem('gh_wizard_target', STATE.targetRepo);
}

/** Clears all persisted state from localStorage and IndexedDB, resets STATE. */
export function clearState() {
    localStorage.clear();
    // Clear IndexedDB
    const tx = db.transaction([STORE_FILES], 'readwrite');
    tx.objectStore(STORE_FILES).clear();

    STATE.token = null;
    STATE.user = null;
    STATE.templateRepo = 'CollectionBuilder/collectionbuilder-gh';
    STATE.targetRepo = null;
    STATE.csvFile = null;
    STATE.mediaFiles = [];
    STATE.currentStep = 0;
    STATE.maxStep = 0;
}
