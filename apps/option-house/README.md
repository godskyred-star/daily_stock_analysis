# KZG Option House

Static US options daily terminal. Chinese first, with an English chrome toggle. History in `data/report.json` is a seeded simulation (seed 6886) except the 2026-09-25 aggregates, which are fixed anchors.

## Regenerate the fixture

From this directory:

```bash
python3 scripts/build_fixture.py
```

The script uses only the Python standard library and rewrites `data/report.json`.

## Serve

```bash
python3 -m http.server 8765
```

Open `http://127.0.0.1:8765/`.

## Metric notes

Every metric label has a dotted underline and a `?`. Hover or focus shows a one-line definition. The toolbar button `指标说明` / `Notes` opens the full glossary, grouped by section. The language toggle switches those notes. Definitions describe how the number is counted. A CP above 1 only means more call contracts traded, not a forecast.

PNG export downloads the newspaper sheet only, as `kzg-option-house-YYYY-MM-DD.png`. Theme and language are stored in `localStorage`.
