<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1DjZTsUltQ3ZNpiisRdux-bZtb3FgpALa

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`


## Development checks

Use Node.js 22.12 or newer (CI uses Node.js 22), then run:

```sh
npm ci
npm run lint       # Oxlint: TypeScript and React Hooks rules
npm run typecheck  # TypeScript strict mode
npm test           # Vitest + React Testing Library, no API calls or secrets
npm run build
```

`npm run test:watch` runs tests during development. Tests cover theme preference
and listener cleanup, library/progress persistence, PDF text extraction, and
audio context lifecycle with mocked audio services. They do not
verify real browser pagination, audio playback, or live Gemini responses.

Pull requests run `.github/workflows/ci.yml` without repository secrets. Pushes
to `main` and manual deployments call the same checks before building and
publishing GitHub Pages. Failed checks prevent deployment. To also block merging
failing pull requests, make the CI check required in the repository branch rules.

## Structure

- `App.tsx`: library/reader navigation and shared state.
- `components/`: library, reader, and selection tooltip UI.
- `hooks/useTheme.ts`: saved/system theme preference and document synchronization.
- `services/`: local book storage, PDF extraction, and Gemini calls.
- `types.ts`: shared application types.

This structure is suitable for a small SPA. As the reader grows, pagination,
selection/translation, and audio lifecycle should move into separate hooks.
PDF.js and Tailwind are currently loaded from CDNs in `index.html`.

## Gemini key and deployment

Pages deployment expects the repository Actions secret `GEMINI_API_KEY` and
Pages source set to **GitHub Actions**. Vite embeds this key in the published
JavaScript: it is readable by visitors, even though it is stored as a GitHub
secret. Keeping a shared key private requires an authenticated backend with
usage limits. A static-only alternative is letting each user supply their own
key instead of embedding the repository owner's key.
