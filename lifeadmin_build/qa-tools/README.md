# HomeAdmin browser QA

This is optional developer tooling, separate from the customer app bundle. Package versions and lockfile are committed so setup is reproducible.

From lifeadmin_build:

```sh
npm ci --prefix qa-tools
npm run --prefix qa-tools install:browser
npm run build:local
python -m http.server 5174 --bind 127.0.0.1 --directory artifacts/adminpilot-ai/dist-local/public
```

With that local server running, use another terminal:

```sh
npm run --prefix qa-tools test:home
npm run --prefix qa-tools test:bills
npm run --prefix qa-tools test:help
npm run --prefix qa-tools test:layout
```

HOMEADMIN_QA_URL optionally selects a different local test server for home/bills/help. Layout starts its own local server. Use synthetic records only. Home scans empty-home accessibility in collapsed/expanded calendar states; bills checks entry/forecast/persistence; help checks AI handoff/review/results and all dates; layout checks responsive text, keyboard and service links.

Automated tests do not establish full accessibility, real AI answer quality, verified offers, installed-device calendar delivery or overall 9/10 app quality. Firecrawl and Context7 are separate assistant capabilities, not dependencies or runtime features of HomeAdmin.
