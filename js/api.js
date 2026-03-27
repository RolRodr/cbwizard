import { STATE } from './constants.js';

/** Sends an authenticated request to the GitHub API and returns the parsed JSON response. */
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

/** Fetches all repositories for the authenticated user, handling pagination. */
export async function fetchUserRepos(token = STATE.token) {
    let repos = [];
    let page = 1;
    let keepFetching = true;

    while (keepFetching) {
        // max 100 repos per page
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

/** Fetches the README content for a repository. */
export async function getRepoReadme(owner, repo, token = STATE.token) {
    // Try to get README
    // GET /repos/{owner}/{repo}/readme
    return githubRequest(`/repos/${owner}/${repo}/readme`, 'GET', null, token);
}

/** Fetches the contents of a repository at the given path. */
export async function getRepoContents(owner, repo, path = '', token = STATE.token) {
    // GET /repos/{owner}/{repo}/contents/{path}
    return githubRequest(`/repos/${owner}/${repo}/contents/${path}`, 'GET', null, token);
}

/** Retrieves the GitHub Pages configuration for a repository, returning null if not enabled. */
export async function getGitHubPages(owner, repo, token = STATE.token) {
    try {
        return await githubRequest(`/repos/${owner}/${repo}/pages`, 'GET', null, token);
    } catch (e) {
        if (e.status === 404) return null;
        throw e;
    }
}

/** Enables GitHub Pages on the repository. Uses GitHub Actions for the CSV template, branch deploy for GH template. */
export async function enableGitHubPages(owner, repo, buildType = 'legacy', token = STATE.token) {
    const isWorkflow = buildType === 'workflow';
    const postBody = isWorkflow
        ? { build_type: 'workflow' }
        : { build_type: 'legacy', source: { branch: 'main', path: '/' } };
    const putBody = isWorkflow
        ? { build_type: 'workflow' }
        : { build_type: 'legacy', source: { branch: 'main', path: '/' } };

    let alreadyExists = false;
    if (await getGitHubPages(owner, repo, token)) alreadyExists = true;

    if (!alreadyExists) {
        try {
            await githubRequest(`/repos/${owner}/${repo}/pages`, 'POST', postBody, token);
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

    // Always ensure Pages is set to the correct build type
    try {
        await githubRequest(`/repos/${owner}/${repo}/pages`, 'PUT', putBody, token);
    } catch (e) {
        console.warn('Could not update Pages config:', e.message);
    }

    return alreadyExists ? { alreadyEnabled: true } : {};
}

/** Commits the Jekyll GitHub Actions workflow file required by the CSV template. */
export async function createJekyllWorkflow(owner, repo, token = STATE.token) {
    const workflowPath = '.github/workflows/jekyll.yml';
    const workflowContent = `# This workflow uses actions that are not certified by GitHub.
# They are provided by a third-party and are governed by
# separate terms of service, privacy policy, and support
# documentation.

# Sample workflow for building and deploying a Jekyll site to GitHub Pages
name: Deploy Jekyll site to Pages

on:
  # Runs on pushes targeting the default branch
  push:
    branches: ["main"]

  # Allows you to run this workflow manually from the Actions tab
  workflow_dispatch:

# Sets permissions of the GITHUB_TOKEN to allow deployment to GitHub Pages
permissions:
  contents: read
  pages: write
  id-token: write

# Allow only one concurrent deployment, skipping runs queued between the run in-progress and latest queued.
# However, do NOT cancel in-progress runs as we want to allow these production deployments to complete.
concurrency:
  group: "pages"
  cancel-in-progress: false

jobs:
  # Build job
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      - name: Setup Ruby
        # https://github.com/ruby/setup-ruby/releases/tag/v1.207.0
        uses: ruby/setup-ruby@4a9ddd6f338a97768b8006bf671dfbad383215f4
        with:
          ruby-version: '3.1' # Not needed with a .ruby-version file
          bundler-cache: true # runs 'bundle install' and caches installed gems automatically
          cache-version: 0 # Increment this number if you need to re-download cached gems
      - name: Setup Pages
        id: pages
        uses: actions/configure-pages@v5
      - name: Build with Jekyll
        # Outputs to the './_site' directory by default
        run: bundle exec jekyll build --baseurl "\${{ steps.pages.outputs.base_path }}"
        env:
          JEKYLL_ENV: production
      - name: Upload artifact
        # Automatically uploads an artifact from the './_site' directory by default
        uses: actions/upload-pages-artifact@v3

  # Deployment job
  deploy:
    environment:
      name: github-pages
      url: \${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
`;

    // Skip if workflow already exists
    try {
        await githubRequest(`/repos/${owner}/${repo}/contents/${workflowPath}`, 'GET', null, token);
        return { alreadyExists: true };
    } catch (e) {
        if (e.status !== 404) throw e;
    }

    const base64Content = btoa(unescape(encodeURIComponent(workflowContent)));
    await githubRequest(`/repos/${owner}/${repo}/contents/${workflowPath}`, 'PUT', {
        message: 'Add Jekyll GitHub Actions workflow for GitHub Pages',
        content: base64Content
    }, token);

    return {};
}

/** Creates or updates a file in the repository via the GitHub Contents API. */
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
