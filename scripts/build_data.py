"""Build the static corpus JSON while preserving the supplied CSV unchanged."""
from __future__ import annotations

import csv
import json
import re
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "NVAtlas-AI-Agent.csv"
OUTPUT = ROOT / "data" / "corpus.json"
RETRIEVED = "2026-11-05"


def classify(term: str) -> str:
    term = term.lower()
    if re.search(r"(tion|sion)$", term):
        return "action"
    if term.endswith("ment"):
        return "result"
    if re.search(r"(ance|ence|ancy|ency)$", term):
        return "quality"
    return "other"


def main() -> None:
    with SOURCE.open(newline="", encoding="utf-8-sig") as handle:
        raw = list(csv.DictReader(handle))

    records = []
    for row in raw:
        source_text = row["English"].strip()
        target_text = row["Chinese"].strip()
        nominal = row["English_Nominal"].strip().lower()
        verb = row["Chinese_Verb"].strip()
        records.append(
            {
                "id": int(row["id"]),
                "source_text": source_text,
                "target_text": target_text,
                "source": (
                    "NV Atlas / OpenSubtitles v2024 en-zh_CN, sentence ID "
                    f"{row['id']}; exported in NVAtlas-AI-Agent.csv, retrieved {RETRIEVED}"
                ),
                "category": classify(nominal),
                "human_checked": False,
                "unit": source_text,
                "key_term": nominal,
                "target_term": verb,
                "target_term_included": verb in target_text,
            }
        )

    records.sort(key=lambda item: item["id"])
    nominal_counts = Counter(item["key_term"] for item in records)
    category_counts = Counter(item["category"] for item in records)
    translations: dict[str, Counter[str]] = defaultdict(Counter)
    for item in records:
        translations[item["key_term"]][item["target_term"]] += 1

    ambiguous_terms = [
        {"term": term, "count": sum(counter.values()), "variants": len(counter)}
        for term, counter in translations.items()
        if len(counter) > 1
    ]
    ambiguous_terms.sort(key=lambda item: (-item["variants"], -item["count"], item["term"]))

    payload = {
        "meta": {
            "title": "NV Atlas AI Agent sample",
            "record_count": len(records),
            "source_file": SOURCE.name,
            "retrieved": RETRIEVED,
            "human_checked_count": 0,
            "nominal_type_count": len(nominal_counts),
            "category_count": len(category_counts),
            "ambiguous_term_count": len(ambiguous_terms),
            "notes": (
                "NV Atlas identifies OpenSubtitles v2024 as its source and exposes the same sentence IDs. "
                "The supplied CSV did not include manual-check marks or a documented random seed."
            ),
        },
        "categories": {
            "action": {
                "name_en": "Action or process",
                "name_zh": "動作或過程",
                "definition_en": "Nominals ending in -tion or -sion, often naming an event or process.",
                "definition_zh": "以 -tion 或 -sion 結尾，通常表示事件或過程的名詞。",
                "rule_en": "Term ends in -tion or -sion.",
                "rule_zh": "詞語以 -tion 或 -sion 結尾。",
            },
            "result": {
                "name_en": "Result or state",
                "name_zh": "結果或狀態",
                "definition_en": "Nominals ending in -ment, often naming a result, state, or thing.",
                "definition_zh": "以 -ment 結尾，通常表示結果、狀態或事物的名詞。",
                "rule_en": "Term ends in -ment and was not matched by an earlier rule.",
                "rule_zh": "詞語以 -ment 結尾，且不符合較先的規則。",
            },
            "quality": {
                "name_en": "Quality or condition",
                "name_zh": "性質或情況",
                "definition_en": "Nominals ending in -ance, -ence, -ancy, or -ency.",
                "definition_zh": "以 -ance、-ence、-ancy 或 -ency 結尾的名詞。",
                "rule_en": "Term ends in -ance, -ence, -ancy, or -ency.",
                "rule_zh": "詞語以 -ance、-ence、-ancy 或 -ency 結尾。",
            },
            "other": {
                "name_en": "Other nominal form",
                "name_zh": "其他名詞形式",
                "definition_en": "Nominals whose form does not match the three suffix rules above.",
                "definition_zh": "不符合上述三種後綴規則的名詞。",
                "rule_en": "No suffix match; keep for coverage and comparison.",
                "rule_zh": "不符合上述後綴；保留作覆蓋與比較。",
            },
        },
        "records": records,
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(records)} records to {OUTPUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
