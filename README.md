# Budget Planner

A simple, self-contained personal finance app for tracking income, expenses, and monthly budgets. No build step, no backend, no external services — it runs entirely as static HTML/CSS/JS in your browser, with data saved to `localStorage`.

## Features

- **Add transactions** — log income or expenses with amount, category, description, and date.
- **Monthly view** — navigate between months with the header's `‹ ›` controls; all summaries, charts, and lists are scoped to the selected month.
- **Dashboard summary** — total income, total expenses, net balance, and savings rate for the current month.
- **Budget limits** — set a monthly spending limit per expense category and see a live progress bar (green → amber at 80% → red when over budget).
- **Charts** — an expense breakdown donut chart by category, and a 6-month income vs. expenses bar chart. Both are drawn with plain `<canvas>` — no external chart library or CDN required, so the app works fully offline.
- **Filter & search transactions** — filter the transaction table by category or type.
- **CSV export** — download all transactions as a CSV file.
- **Light/dark mode** — follows your OS theme automatically.
- **Private by default** — all data stays in your browser's `localStorage`; nothing is sent to a server.

## Running it

No install or build step is needed. Either:

- Open `index.html` directly in a browser, or
- Serve the folder locally, e.g.:

  ```bash
  python3 -m http.server 8000
  ```

  then visit `http://localhost:8000`.

## Project structure

```
index.html        Page structure/markup
css/styles.css     Styling, layout, light/dark theme
js/app.js          App state, rendering, and chart drawing logic
```

## Data & privacy

All transactions and budget limits are stored under a single `localStorage` key in your browser. Clearing your browser's site data for this page will erase it — use **Export CSV** first if you want a backup. There is no server component and no account system.

## Customizing

- **Currency**: change `CURRENCY_LOCALE` / `CURRENCY_CODE` near the top of `js/app.js`.
- **Categories**: edit the `CATEGORIES` object in `js/app.js` to add/remove income or expense categories (and add a matching entry to `CATEGORY_COLORS` for chart coloring).
