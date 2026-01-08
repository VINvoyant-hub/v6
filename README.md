# New Netlify project scaffold

This repository is set up as a clean starting point for a new Netlify site.

## Where to put new code

- Static site files live in `site/` and are deployed as-is.
- Netlify Functions (optional) live in `netlify/functions/`.
- Previous work was preserved in `archive/legacy/`.

## Preview → permanent workflow

- Put changes on a branch and open a pull request to generate a Deploy Preview.
- After the preview looks correct, merge the pull request to make the change permanent on the production branch.

## Local development

```sh
npm run dev
```

This runs Netlify Dev on `http://localhost:8888` and serves the `site/` directory.

