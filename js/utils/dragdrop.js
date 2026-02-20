/** Wraps a file input with a drag-and-drop zone that supports file validation. */
export function enableDropZone(inputEl, { label = 'Drop files here', accept } = {}) {
    if (!inputEl) return;

    // Create drop zone wrapper
    const dropZone = document.createElement('div');
    dropZone.className = 'drop-zone';
    dropZone.setAttribute('role', 'button');
    dropZone.setAttribute('tabindex', '0');
    dropZone.setAttribute('aria-label', label);

    // Icon + label
    const icon = document.createElement('div');
    icon.className = 'drop-zone-icon';
    icon.textContent = '';

    const text = document.createElement('div');
    text.className = 'drop-zone-text';
    text.textContent = label;

    const hint = document.createElement('div');
    hint.className = 'drop-zone-hint';
    hint.textContent = 'or click to browse files';

    dropZone.appendChild(icon);
    dropZone.appendChild(text);
    dropZone.appendChild(hint);

    // Insert drop zone after the input, hide the raw input visually
    inputEl.parentNode.insertBefore(dropZone, inputEl.nextSibling);
    inputEl.classList.add('sr-only'); // Hide visually but keep accessible

    // Click on drop zone triggers file picker
    dropZone.addEventListener('click', () => inputEl.click());
    dropZone.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            inputEl.click();
        }
    });

    // Drag events
    let dragCounter = 0;

    dropZone.addEventListener('dragenter', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter++;
        dropZone.classList.add('drop-zone-active');
    });

    dropZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter--;
        if (dragCounter === 0) {
            dropZone.classList.remove('drop-zone-active');
        }
    });

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter = 0;
        dropZone.classList.remove('drop-zone-active');

        const files = e.dataTransfer.files;
        if (files.length > 0) {
            // Validate dropped files against the input's accept attribute
            const acceptAttr = inputEl.getAttribute('accept');
            if (acceptAttr) {
                const acceptedTypes = acceptAttr.split(',').map(t => t.trim().toLowerCase());
                const validFiles = Array.from(files).filter(f => {
                    const ext = '.' + f.name.split('.').pop().toLowerCase();
                    const mime = f.type.toLowerCase();
                    return acceptedTypes.some(a => {
                        if (a.startsWith('.')) return ext === a;           // extension match
                        if (a.endsWith('/*')) return mime.startsWith(a.replace('/*', '/'));  // wildcard MIME
                        return mime === a;                                  // exact MIME
                    });
                });
                if (validFiles.length === 0) {
                    alert('That file type is not accepted. Please drop a valid file (' + acceptAttr + ').');
                    return;
                }
                // Build a DataTransfer with only the valid files
                const dt = new DataTransfer();
                validFiles.forEach(f => dt.items.add(f));
                inputEl.files = dt.files;
            } else {
                inputEl.files = files;
            }
            // Trigger the change event so existing handlers fire
            inputEl.dispatchEvent(new Event('change', { bubbles: true }));
        }
    });

    return dropZone;
}
