# NV Atlas | Nominal to Verb

A static corpus explorer for 500 English-Chinese subtitle pairs. It examines English abstract nominals and the Chinese verbs used to translate them.

**Live site:** https://pangwaikwan.github.io/nvatlas-test/

## Features

- Bilingual English and Traditional Chinese interface.
- Search across both languages and filter by morphological category, translation variation, and review status.
- Three linked visualizations: a category flow diagram, a nominal-to-verb network, and a bilingual KWIC view.
- Shareable search state in the URL and filtered CSV export.
- Learning report, codebook, source information, and AI Use Declaration.

## Data

The source file is `NVAtlas-AI-Agent.csv`, containing 500 pairs from the NV Atlas sample. NV Atlas identifies its source as OpenSubtitles v2024 (English-Simplified Chinese). The original CSV provides sentence IDs, English and Chinese text, an English nominal, and a Chinese verb.

`data/corpus.json` is generated from the CSV and adds the fields required by the project brief:

- `source_text`
- `target_text`
- `source`
- `category`
- `human_checked`
- optional analysis fields `unit`, `key_term`, and `target_term`

Categories use a transparent suffix rule: `-tion/-sion`, `-ment`, and `-ance/-ence/-ancy/-ency`, with all other forms in a comparison category.

### Verification status

The supplied CSV did not contain manual-check marks. All 500 records therefore have `human_checked: false`. Manual verification against upstream subtitle sources still needs to be completed before the project is submission-ready. The interface and report show this limitation rather than claiming unperformed checks.

## Run locally

```bash
python3 -m http.server 4173
```

Open <http://127.0.0.1:4173/>.

## Rebuild the data

```bash
python3 scripts/build_data.py
```

## Project files

```text
index.html                 Static explorer
assets/styles.css          Layout and responsive styling
assets/i18n.js             English and Traditional Chinese interface strings
assets/app.js              Search, filters, charts, table, and CSV export
data/corpus.json           Required project schema and analysis metadata
scripts/build_data.py      Rebuilds corpus.json from the source CSV
NVAtlas-AI-Agent.csv       Original 500-pair source file
```
