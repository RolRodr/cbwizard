import { STATE } from './constants.js';

// --- GitHub API Wrapper ---
export async function githubRequest(endpoint, method = 'GET', body = null, token = STATE.token) {
    if (!token) throw new Error("No access token provided.");

    const url = endpoint.startsWith('http') ? endpoint : `https://api.github.com${endpoint}`;
    const options = {
        method,
        headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
        }
    };

    if (body) options.body = JSON.stringify(body);

    const response = await fetch(url, options);

    if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        const err = new Error(errData.message || `GitHub API Error: ${response.status} ${response.statusText}`);
        err.status = response.status;
        throw err;
    }

    // Handle 204 No Content or empty responses
    if (response.status === 204) return null;

    return response.json();
}

/**
 * Fetch all repositories for the authenticated user.
 * Handles pagination to get all repos.
 */
export async function fetchUserRepos(token = STATE.token) {
    let repos = [];
    let page = 1;
    let keepFetching = true;

    while (keepFetching) {
        // per_page=100 is the max
        const data = await githubRequest(`/user/repos?sort=updated&per_page=100&page=${page}&type=owner`, 'GET', null, token);

        if (data && data.length > 0) {
            repos = repos.concat(data);
            if (data.length < 100) {
                keepFetching = false;
            } else {
                page++;
            }
        } else {
            keepFetching = false;
        }
    }
    return repos;
}

/**
 * Fetch README content for a repository.
 */
export async function getRepoReadme(owner, repo, token = STATE.token) {
    // Try to get README
    // GET /repos/{owner}/{repo}/readme
    return githubRequest(`/repos/${owner}/${repo}/readme`, 'GET', null, token);
}

/**
 * Fetch contents of a repository path.
 */
export async function getRepoContents(owner, repo, path = '', token = STATE.token) {
    // GET /repos/{owner}/{repo}/contents/{path}
    return githubRequest(`/repos/${owner}/${repo}/contents/${path}`, 'GET', null, token);
}

/**
 * Enable GitHub Pages on the repository using the main branch.
 * If Pages is already enabled, this is a no-op (catches 409).
 */
export async function enableGitHubPages(owner, repo, token = STATE.token) {
    let alreadyExists = false;

    try {
        // Check if Pages is already enabled
        await githubRequest(`/repos/${owner}/${repo}/pages`, 'GET', null, token);
        alreadyExists = true;
    } catch (e) {
        if (e.status !== 404) throw e;
    }

    if (!alreadyExists) {
        // Pages not yet enabled — create it (deploy from branch, not Actions)
        try {
            await githubRequest(`/repos/${owner}/${repo}/pages`, 'POST', {
                build_type: 'legacy',
                source: {
                    branch: 'main',
                    path: '/'
                }
            }, token);
        } catch (e) {
            // 409 = already exists (race condition)
            if (e.status === 409) {
                alreadyExists = true;
            } else if (e.status === 422) {
                console.warn('Could not auto-enable GitHub Pages:', e.message);
                return { error: e.message };
            } else {
                throw e;
            }
        }
    }

    // Always ensure it's set to "deploy from branch" (legacy), not Actions (workflow)
    try {
        await githubRequest(`/repos/${owner}/${repo}/pages`, 'PUT', {
            build_type: 'legacy',
            source: {
                branch: 'main',
                path: '/'
            }
        }, token);
    } catch (e) {
        console.warn('Could not update Pages config to deploy-from-branch:', e.message);
    }

    return alreadyExists ? { alreadyEnabled: true } : {};
}

/**
 * Update (PUT) a file in the repository.
 */
export async function updateRepoFile(owner, repo, path, content, message, token = STATE.token) {
    // First get the file's SHA if it exists
    let sha = null;
    try {
        const existing = await githubRequest(`/repos/${owner}/${repo}/contents/${path}`, 'GET', null, token);
        sha = existing.sha;
    } catch (e) {
        if (e.status !== 404) throw e;
    }

    const base64Content = btoa(unescape(encodeURIComponent(content)));
    const body = {
        message,
        content: base64Content,
        ...(sha ? { sha } : {})
    };

    return githubRequest(`/repos/${owner}/${repo}/contents/${path}`, 'PUT', body, token);
}
