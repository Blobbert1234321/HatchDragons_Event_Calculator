# HatchDragons Event Calculator

A community-made calculator for cooking and fishing events. It runs entirely in the browser and does not connect to a game account. The website is unofficial and not affiliated with the game developers.

## Publish on GitHub Pages

1. Upload the **contents** of the website ZIP to the root of `Blobbert1234321/HatchDragons_Event_Calculator`. `index.html` must be directly inside the repository, not inside another folder. Do not upload the ZIP itself.
2. In GitHub, open **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**.
4. Choose **main**, **/(root)**, then **Save**.
5. GitHub will show the published website address. The expected address is:
   `https://blobbert1234321.github.io/HatchDragons_Event_Calculator/`

The address becomes available only after GitHub's deployment finishes. No build command, package installation, MATLAB license, API key, or paid domain is required to use the hosted calculator.

## Use the calculator

- Choose **Cooking** or **Fishing**.
- Select a full event or **From now**. For From now, enter fractional days remaining, current round, last claimed reward, and points toward the next reward. Reward 0 means no reward claimed in that round.
- Desired completions is the **total target**, including rounds already completed.
- Enter resources you own and optionally enable the 1.5× multiplier.
- Open Advanced sections to edit inventory, bonus allowances, fish leftovers, combo progress, hook policy, costs, or exact reward requirements.
- Calculate the recommendation, inspect its schedule and trade-off plots, and export the results to CSV.
- Daily activity comparison calculates each selected activity count independently. Choose a scenario to view that scenario's schedule and breakdown.
- Share settings creates a link containing the inputs. Inputs also persist in local storage on the device. There are no accounts or analytics.

### Cooking model

Cooking counts one basic bag and one free cooking batch per daily action. Bag types are pooled, and higher-point ingredients are used first. All parsnip, fish, and meat must be cooked. Free bonus rounds are per ingredient and share existing free cooking capacity. Each instant cook adds a shared pool of bonus slots; bonus points are applied at most once per ingredient.

With the multiplier active, every fancy-bag ingredient must be instant cooked in the early period. The remaining instant capacity can process basic food. Later days use free cooking at 1×, with early leftovers carried forward. Free bonus quotas are split across phases in proportion to the number of days. This constraint can make equal resource use infeasible; the calculator reports that rather than inventing a plan.

### Fishing model

Each successful catch receives two inventory fish by default but advances a combo counter only once. Hooks guarantee a catch. Repeating combos can generate more fish and hooks, which feed subsequent combo generations. Each color's expected leftover inventory is excluded from trade points, reserving late fish first. Hurries are assumed used just after free spawns so a timer reset does not replace a planned free spawn. Trade refresh time and costs are not modeled.

The search compares no hooks, purple only, purple + yellow, and successively broader policies. It minimizes new resource gem purchases; ties preserve hooks, then hurries. Hook rewards are credited in the generation after they are earned. Actual owned resources and purchases are whole numbers; modeled catches, hook consumption, and inventory can be fractional.

These are deterministic approximations. Combo counts use floors of cumulative expected catches. A floor of an average is not the true statistical expectation of random combo counts. Results are **planning estimates, not guaranteed completion or probabilities of success**.

### Multiplier and schedule

The default multiplier costs 1,085 gems and lasts five days. Later points earn 1×. Already-purchased multipliers with remaining active time are not charged again. From now mode uses only future resources and earnings; prior progress is subtracted from the target. Full-event Cooking follows the MATLAB script's original purchase settings.

Schedules show smooth points checkpoints, with the active and inactive multiplier periods weighted by their modeled earnings. They are not exact login, trade, or bonus-window schedules. Purchases do not imply a connection to or transaction in the game.

## Files

- `index.html`, `styles.css`, `icon.svg`: interface and visual design.
- `app.mjs`: forms, device storage, share links, SVG charts, and CSV export.
- `engines.mjs`: independent calculation engines and shared progress/schedule math.
- `worker.mjs`: performs calculations off the main browser thread so the interface stays responsive. Stop calculation cancels the worker.
- `.nojekyll`: serves the plain static files on GitHub Pages.
- `test.mjs`, `test-data/`: parity checks against MATLAB reference cases.

## Local preview and tests

Serve the directory using a local HTTP server; do not double-click `index.html`, because browsers restrict module workers on file URLs. For example, with Python installed:

```text
python -m http.server 8000
```

Then open `http://localhost:8000/`.

With Node.js installed, run `npm test` or `node test.mjs`. No dependency installation is needed. Tests compare nine default, remaining-event, multiplier, no-hook, and equal-resource cases with JSON exported from the original MATLAB scripts. Additional tests check exact round totals, input validation, completed targets, analytic catch-rate calculations, activity ranges, and partial days.

To update game rules, edit the defaults in `engines.mjs`. Existing visitors' saved settings can be reset with the Reset button. When changing calculation rules, update the MATLAB references and re-run tests before publishing.
