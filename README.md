# CollectionBuilder Wizard

A simple, browser-based wizard that helps you create a [CollectionBuilder](https://collectionbuilder.github.io/) digital exhibit without having to deal with the technical curve of GitHub too much. This project is meant to be a really gentle introduction to CollectionBuilder, in addition to providing some helpful utilities, such as pointing out potential issues or errors with your exhibit metadata before uploading it to your CollectionBuilder Repository. 

## Features

- **Step-by-step guided workflow** — A six-step wizard walks you through connecting to GitHub, forking the official [CollectionBuilder-GH](https://github.com/CollectionBuilder/collectionbuilder-gh) template, uploading CSV metadata, adding media files, configuring your site, and publishing to GitHub Pages.
- **GitHub integration** — Authenticate with a Personal Access Token, fork the template repository, and push all content directly from your browser.
- **CSV metadata support** — Upload your own collection metadata CSV or preview the demo data that ships with the template. Includes a live table preview and filename customization.
- **Media file management** — Add images, audio, and PDFs to your collection with drag-and-drop support, image previews, and a 10 MB per-file size guard.
- **Site configuration** — Set your site title, tagline, description, metadata filename, and featured image before publishing.
- **One-click publish** — Uploads your CSV, media files, and updated configuration, then enables GitHub Pages — all in a single action with a progress indicator.
- **Use an existing repository** — Already forked CollectionBuilder? Select it from a searchable list of your repositories instead of creating a new fork.
- **Fully client-side** — No backend server, no database, no analytics. Everything runs in your browser.

## Privacy & Security

CollectionBuilder Wizard takes your privacy seriously. Your GitHub token is **AES-256-GCM encrypted** before being stored in the browser, a strict **Content Security Policy** blocks unauthorized scripts and network requests, and **all data is cleared on logout** — nothing is ever sent to a third-party server. The entire application runs only on the client side.

For the full details, see [PRIVACY.md](PRIVACY.md).

## Getting Started

1. Open the app in your browser.
2. Click **Get Started** and enter a GitHub Personal Access Token with `repo` scope.
3. Fork the CollectionBuilder-GH template (or select an existing fork).
4. Upload your CSV metadata and optional media files.
5. Configure your site settings and hit **Publish**.
6. Visit your new GitHub Pages site!

## Credits

- Built on the [CollectionBuilder](https://collectionbuilder.github.io/) framework created by the Center for Digital Inquiry and Learning (CDIL) at the University of Idaho.
- Icons by [Noun Project](https://thenounproject.com).


## Potential Improvements
- Option to use the Google Sheets Template with a different walk through
- Edit CSV in browser
- More Exhibit customization options

Let me know if you have any other suggestions writing up an issue
