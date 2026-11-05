"""Structural checks for the static corpus explorer."""
from __future__ import annotations

import csv
import json
import re
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REQUIRED_FILES = [
    "index.html",
    "assets/styles.css",
    "assets/i18n.js",
    "assets/app.js",
    "data/corpus.json",
    "NVAtlas-AI-Agent.csv",
]
REQUIRED_FIELDS = {
    "source_text", "target_text", "source", "category", "human_checked",
    "unit", "key_term", "target_term",
}
REQUIRED_IDS = {
    "search", "category", "variation", "checked", "flowChart", "networkChart",
    "kwicList", "dataTable", "downloadCsv", "downloadFiltered", "report",
    "codebook", "ai-use",
}


class IdParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.ids: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        for key, value in attrs:
            if key == "id" and value:
                self.ids.append(value)


def main() -> None:
    for relative in REQUIRED_FILES:
        assert (ROOT / relative).is_file(), f"Missing {relative}"

    with (ROOT / "NVAtlas-AI-Agent.csv").open(newline="", encoding="utf-8-sig") as handle:
        source_rows = list(csv.DictReader(handle))
    assert len(source_rows) == 500, f"Expected 500 CSV rows, found {len(source_rows)}"
    assert len({row["id"] for row in source_rows}) == 500, "CSV IDs are not unique"

    corpus = json.loads((ROOT / "data/corpus.json").read_text(encoding="utf-8"))
    records = corpus["records"]
    assert len(records) == 500, f"Expected 500 JSON records, found {len(records)}"
    assert len({row["id"] for row in records}) == 500, "JSON IDs are not unique"
    for record in records:
        missing = REQUIRED_FIELDS - record.keys()
        assert not missing, f"Record {record.get('id')} missing {sorted(missing)}"
    assert {row["category"] for row in records} == {"action", "quality", "result", "other"}
    assert all(row["human_checked"] is False for row in records)

    html = (ROOT / "index.html").read_text(encoding="utf-8")
    parser = IdParser()
    parser.feed(html)
    duplicates = sorted({item for item in parser.ids if parser.ids.count(item) > 1})
    assert not duplicates, f"Duplicate HTML IDs: {duplicates}"
    assert REQUIRED_IDS <= set(parser.ids), f"Missing IDs: {sorted(REQUIRED_IDS - set(parser.ids))}"

    translation_source = (ROOT / "assets/i18n.js").read_text(encoding="utf-8")
    for language in ("en", "zh"):
        assert re.search(rf"\n  {language}: \{{", translation_source), f"Missing {language} translations"

    print("Validation passed")
    print(f"  CSV and JSON records: {len(records)}")
    print(f"  Categories: {sorted(corpus['categories'])}")
    print("  Required schema fields: present")
    print("  HTML IDs: unique and complete")
    print("  Translation bundles: English and Traditional Chinese present")


if __name__ == "__main__":
    main()
