import { STATE } from '../constants.js';
import { ELEMENTS } from '../elements.js';
import { parseCSV } from '../utils/csv.js';

// ─────── Step 5: Config Form ───────

/** Populates the featured image dropdown with image-type objectids from the CSV.
 *  Works with both an uploaded CSV (STATE.csvFile) and a linked Google Sheet URL
 *  (STATE.googleSheetUrl) by fetching the sheet on-demand when needed.
 */
async function populateFeaturedImageSelect() {
    const select = ELEMENTS.configFeaturedImage;
    if (!select) return;

    // Clear existing options (keep the first "None" option)
    while (select.options.length > 1) {
        select.remove(1);
    }

    // Resolve CSV content: prefer local file, fall back to Google Sheet URL
    let csvContent = STATE.csvFile?.content || null;

    if (!csvContent && STATE.googleSheetUrl) {
        try {
            const response = await fetch(STATE.googleSheetUrl);
            if (response.ok) {
                const text = await response.text();
                if (!text.trim().startsWith('<!DOCTYPE html>')) {
                    csvContent = text;
                }
            }
        } catch (_) {
            // If fetch fails, just leave the dropdown empty
        }
    }

    if (!csvContent) return;

    const rows = parseCSV(csvContent);
    if (rows.length < 2) return;

    const header = rows[0].map(h => h.trim().toLowerCase());
    const objectidIdx = header.indexOf('objectid');
    const titleIdx = header.indexOf('title');
    const formatIdx = header.indexOf('format');

    if (objectidIdx === -1) return; // No objectid column

    rows.slice(1).forEach(row => {
        const objectid = (row[objectidIdx] || '').trim();
        if (!objectid) return;

        const title = titleIdx !== -1 ? (row[titleIdx] || '').trim() : '';
        const format = formatIdx !== -1 ? (row[formatIdx] || '').trim() : '';

        // Only show image-type items (or all if no format column)
        const isImage = !format || /image/i.test(format);
        if (!isImage) return;

        const option = document.createElement('option');
        option.value = objectid;
        option.textContent = title ? `${objectid} — ${title}` : objectid;
        select.appendChild(option);
    });

    updateFeaturedImagePreview();
}

/** Displays a thumbnail preview of the selected featured image. */
function updateFeaturedImagePreview() {
    const preview = ELEMENTS.featuredImagePreview;
    const select = ELEMENTS.configFeaturedImage;
    if (!preview || !select) return;

    const objectid = select.value;
    if (!objectid) {
        preview.classList.add('hidden');
        preview.innerHTML = '';
        return;
    }

    preview.innerHTML = '';

    // 1. Check locally-uploaded media files first
    const match = (STATE.mediaFiles || []).find(f => {
        const nameNoExt = f.name.replace(/\.[^.]+$/, '');
        return nameNoExt === objectid;
    });

    if (match && match.type.startsWith('image/')) {
        const img = document.createElement('img');
        img.src = `data:${match.type};base64,${match.content}`;
        img.alt = `Preview of ${objectid}`;
        preview.appendChild(img);
        preview.classList.remove('hidden');
        return;
    }

    // 2. Try to resolve the filename from the CSV's `filename` column
    let remoteFilename = null;
    if (STATE.csvFile && STATE.csvFile.content) {
        const rows = parseCSV(STATE.csvFile.content);
        if (rows.length >= 2) {
            const header = rows[0].map(h => h.trim().toLowerCase());
            const objectidIdx = header.indexOf('objectid');
            const filenameIdx = header.indexOf('filename');
            if (objectidIdx !== -1 && filenameIdx !== -1) {
                const row = rows.slice(1).find(r => (r[objectidIdx] || '').trim() === objectid);
                if (row) remoteFilename = (row[filenameIdx] || '').trim();
            }
        }
    }

    // 3. Build a raw GitHub URL to the image in objects/, or use the URL directly
    if (STATE.targetRepo) {
        const [owner, repo] = STATE.targetRepo.split('/');
        // If the filename from the CSV is already a full URL, use it directly
        const isAbsoluteUrl = remoteFilename && /^https?:\/\//i.test(remoteFilename);
        const imgSrc = isAbsoluteUrl
            ? remoteFilename
            : `https://raw.githubusercontent.com/${owner}/${repo}/main/objects/${remoteFilename || objectid}`;
        const img = document.createElement('img');
        img.alt = `Preview of ${objectid}`;
        img.onerror = () => {
            // Image not found – show the text note instead
            preview.innerHTML = '';
            const note = document.createElement('span');
            note.className = 'featured-image-note';
            note.textContent = `Selected: ${objectid}`;
            preview.appendChild(note);
        };
        img.src = imgSrc;
        preview.appendChild(img);
        preview.classList.remove('hidden');
    } else {
        // No repo context at all – just show the selected name
        const note = document.createElement('span');
        note.className = 'featured-image-note';
        note.textContent = `Selected: ${objectid}`;
        preview.appendChild(note);
        preview.classList.remove('hidden');
    }
}

/** Prepares Step 5 by auto-populating config fields and the publish summary. */
export async function prepareConfigStep() {
    const isGoogleSheetLink = !STATE.csvFile && !!STATE.googleSheetUrl;

    // Auto-populate config metadata: CSV filename (without .csv) or Google Sheet URL
    if (ELEMENTS.configMetadata) {
        if (STATE.csvFile && STATE.csvFile.name) {
            // CollectionBuilder uses the basename without .csv as the metadata value
            ELEMENTS.configMetadata.value = STATE.csvFile.name.replace(/\.csv$/i, '');
        } else if (STATE.googleSheetUrl) {
            ELEMENTS.configMetadata.value = STATE.googleSheetUrl;
        } else {
            ELEMENTS.configMetadata.value = '';
        }
    }

    // Toggle the metadata hint and label to match the current mode
    const hintCsv = document.getElementById('config-metadata-hint-csv');
    const hintUrl = document.getElementById('config-metadata-hint-url');
    const metaLabel = document.getElementById('config-metadata-label');
    if (hintCsv && hintUrl) {
        if (isGoogleSheetLink) {
            hintCsv.classList.add('hidden');
            hintUrl.classList.remove('hidden');
            if (metaLabel) metaLabel.textContent = 'Metadata (Google Sheet URL):';
        } else {
            hintCsv.classList.remove('hidden');
            hintUrl.classList.add('hidden');
            if (metaLabel) metaLabel.textContent = 'Metadata:';
        }
    }

    // Auto-populate title from repo name if empty
    if (ELEMENTS.configTitle && !ELEMENTS.configTitle.value && STATE.targetRepo) {
        const repoName = STATE.targetRepo.split('/')[1] || '';
        ELEMENTS.configTitle.value = repoName.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    }

    // Populate featured image dropdown from CSV objectids (async — may fetch from Google Sheet)
    await populateFeaturedImageSelect();

    // Listen for featured image selection changes to show preview
    if (ELEMENTS.configFeaturedImage) {
        ELEMENTS.configFeaturedImage.onchange = () => {
            updateFeaturedImagePreview();
        };
    }

    // Populate publish summary
    if (ELEMENTS.publishSummaryList) {
        ELEMENTS.publishSummaryList.innerHTML = '';
        const items = [];

        if (STATE.csvFile) {
            items.push(`CSV metadata: ${STATE.csvFile.name || 'data.csv'} → _data/`);
        } else if (STATE.googleSheetUrl) {
            items.push(`Google Sheet URL → set as metadata in _config.yml (no CSV uploaded)`);
        }

        const mediaCount = (STATE.mediaFiles && STATE.mediaFiles.length) || 0;
        if (mediaCount > 0) {
            items.push(`${mediaCount} media file${mediaCount > 1 ? 's' : ''} → objects/`);
        }

        // Render Derivatives Preview Grid if applicable
        const previewContainer = document.getElementById('publish-derivatives-preview');
        const gridContainer = document.getElementById('publish-derivatives-grid');

        if (previewContainer && gridContainer) {
            const derivativeThumbs = (STATE.mediaFiles || []).filter(f => f.id.startsWith('media_thumb_'));

            if (derivativeThumbs.length > 0) {
                gridContainer.innerHTML = '';
                derivativeThumbs.forEach(file => {
                    const thumbWrap = document.createElement('div');
                    thumbWrap.className = 'derivative-thumb-item';
                    thumbWrap.title = file.name;

                    const img = document.createElement('img');
                    img.src = `data:${file.type};base64,${file.content}`;
                    img.alt = `Thumbnail preview for ${file.name}`;

                    thumbWrap.appendChild(img);
                    gridContainer.appendChild(thumbWrap);
                });
                previewContainer.classList.remove('hidden');
            } else {
                previewContainer.classList.add('hidden');
                gridContainer.innerHTML = '';
            }
        }

        items.push('Site configuration (_config.yml)');
        items.push('Enable GitHub Pages');

        items.forEach(text => {
            const li = document.createElement('li');
            li.textContent = text;
            ELEMENTS.publishSummaryList.appendChild(li);
        });
    }
}
