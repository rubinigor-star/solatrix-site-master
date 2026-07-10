# Solatrix approved site upload package

This package contains the approved static Solatrix website pages that should become the main site in the GitHub repository.

## Files included

- `index.html` — main Solatrix homepage
- `private-homes.html` — private homes page
- `solar-price.html` — transparent price page
- `roof-check.html` — roof check marketing / SEO page
- `storage.html` — storage and batteries page
- `business.html` — business / commercial page
- `agriculture.html` — agriculture page
- `faq.html` — FAQ page
- `contact.html` — contact page
- `404.html` — static fallback page

## Target GitHub repository

`rubinigor-star/roof-check-by-solatrix`

## Recommended final structure

```text
/
├── index.html
├── private-homes.html
├── solar-price.html
├── roof-check.html
├── storage.html
├── business.html
├── agriculture.html
├── faq.html
├── contact.html
├── 404.html
└── roof-check/
    └── live calculator app
```

## Important note

The approved HTML files are large because images are embedded directly inside the HTML. Upload them through GitHub Web UI or Agent/Codex with filesystem access. The ChatGPT GitHub connector may not reliably push these large inline-image HTML files directly.

## After upload

Ask ChatGPT/Codex to:

1. Move the existing calculator app into `/roof-check/`.
2. Prefix calculator internal routes with `/roof-check`.
3. Keep the approved site pages at the root.
4. Update CTA links from the main site to the active calculator path `/roof-check/`.
5. Run `npm run build` if the calculator remains a Vite app.
6. Open a PR or update the existing PR.
