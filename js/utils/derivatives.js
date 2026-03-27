/**
 * Utility for generating derivative images (small, thumb) using the browser Canvas API.
 */

const THUMB_WIDTH = 450;
const SMALL_WIDTH = 800;

/**
 * Resizes a base64 image to the specified max width.
 * Returns a promise that resolves to the new base64 string (without data: URI prefix).
 */
function resizeImageBase64(base64, mimeType, maxWidth) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            let width = img.width;
            let height = img.height;

            if (width > maxWidth) {
                height = Math.round((height * maxWidth) / width);
                width = maxWidth;
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            // Export as JPEG for smaller file size
            const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
            const newBase64 = dataUrl.split(',')[1];
            resolve(newBase64);
        };
        img.onerror = reject;
        img.src = `data:${mimeType};base64,${base64}`;
    });
}

/**
 * Extracts the first page of a PDF as a base64 encoded JPEG.
 */
async function extractFirstPageOfPdf(base64) {
    if (typeof pdfjsLib === 'undefined') {
        throw new Error("pdf.js library is not loaded.");
    }

    // Convert base64 to Uint8Array for PDF.js
    const raw = atob(base64);
    const uint8Array = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) {
        uint8Array[i] = raw.charCodeAt(i);
    }

    const loadingTask = pdfjsLib.getDocument({ data: uint8Array });
    const pdf = await loadingTask.promise;
    if (pdf.numPages === 0) throw new Error("PDF has no pages.");

    const page = await pdf.getPage(1);

    // Scale 1.5 gives a good high-res base for later downscaling
    const viewport = page.getViewport({ scale: 1.5 });

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    const renderContext = {
        canvasContext: ctx,
        viewport: viewport
    };

    await page.render(renderContext).promise;

    // Export the canvas as a base64 JPEG
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    return dataUrl.split(',')[1];
}

/**
 * Takes a file object from STATE.mediaFiles and generates thumb and small derivatives if it's an image.
 * Returns an array of derivative file objects to be uploaded.
 */
export async function generateDerivativesForFile(file) {
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
        return []; // Skip non-images (PDFs, audio, etc.)
    }

    try {
        const baseName = file.name.replace(/\.[^/.]+$/, ""); // Strip extension

        let sourceBase64 = file.content;
        let sourceMimeType = file.type;

        // If it's a PDF, first render its page 1 to an image
        if (file.type === 'application/pdf') {
            sourceBase64 = await extractFirstPageOfPdf(file.content);
            sourceMimeType = 'image/jpeg';
        }

        const [thumbBase64, smallBase64] = await Promise.all([
            resizeImageBase64(sourceBase64, sourceMimeType, THUMB_WIDTH),
            resizeImageBase64(sourceBase64, sourceMimeType, SMALL_WIDTH)
        ]);

        const thumbFile = {
            id: `media_thumb_${baseName}`,
            name: `${baseName}_th.jpg`,
            type: 'image/jpeg',
            content: thumbBase64,
            path: `objects/thumbs/${baseName}_th.jpg`
        };

        const smallFile = {
            id: `media_small_${baseName}`,
            name: `${baseName}_sm.jpg`,
            type: 'image/jpeg',
            content: smallBase64,
            path: `objects/small/${baseName}_sm.jpg`
        };

        return [thumbFile, smallFile];
    } catch (err) {
        console.error(`Failed to generate derivatives for ${file.name}:`, err);
        return [];
    }
}
