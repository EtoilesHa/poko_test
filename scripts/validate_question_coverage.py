#!/usr/bin/env python3
"""Verify every public Pokopia catalogue label has an item-card entry point.

The question file deliberately keeps the mapping beside the card copy so it is
easy to review. This small guard prevents a later edit from silently removing
the only item choice for a Pokédex preference or specialty.
"""

from __future__ import annotations

import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CATALOGUE_PATH = ROOT / "data" / "pokemon.catalogue.json"
QUESTIONS_PATH = ROOT / "app" / "data" / "item-questions.ts"
ITEMS_PATH = ROOT / "app" / "assets" / "items"

DIMENSIONS = {
    "favorites": "favorites",
    "flavor": "flavors",
    "environment": "environments",
    "specialties": "specialties",
}


def source_labels(records: list[dict[str, object]], field: str) -> set[str]:
    labels: set[str] = set()
    for record in records:
        value = record.get(field)
        if isinstance(value, list):
            labels.update(str(label) for label in value if label)
        else:
            labels.update(label for label in str(value or "").split() if label)
    return labels


def question_labels(question_source: str, field: str) -> set[str]:
    """Extract explicit `{ '标签': 权重 }` blocks from the item-card data."""
    labels: set[str] = set()
    pattern = re.compile(rf"{re.escape(field)}\s*:\s*\{{(?P<body>[^}}]*)\}}")
    for match in pattern.finditer(question_source):
        labels.update(re.findall(r"'([^']+)'\s*:", match.group("body")))
    return labels


def valid_png(path: Path) -> bool:
    """Reject placeholder/error documents saved with a .png extension."""
    header = path.read_bytes()[:24]
    if header[:8] != b"\x89PNG\r\n\x1a\n" or len(header) < 24:
        return False
    width = int.from_bytes(header[16:20], "big")
    height = int.from_bytes(header[20:24], "big")
    return width > 0 and height > 0


def main() -> int:
    catalogue = json.loads(CATALOGUE_PATH.read_text(encoding="utf-8"))
    records = catalogue["records"]
    question_source = QUESTIONS_PATH.read_text(encoding="utf-8")

    failures: list[str] = []
    for catalogue_field, question_field in DIMENSIONS.items():
        expected = source_labels(records, catalogue_field)
        represented = question_labels(question_source, question_field)
        missing = sorted(expected - represented)
        unknown = sorted(represented - expected)
        print(f"{catalogue_field}: {len(expected) - len(missing)}/{len(expected)} labels represented")
        if missing:
            failures.append(f"{catalogue_field}: missing {'、'.join(missing)}")
        if unknown:
            failures.append(f"{catalogue_field}: unknown {'、'.join(unknown)}")

    item_ids = set(re.findall(r"(?:item\('|id:\s*')([^']+)'", question_source))
    missing_images = sorted(item_id for item_id in item_ids if not (ITEMS_PATH / f"{item_id}.png").is_file())
    invalid_images = sorted(
        item_id for item_id in item_ids
        if (ITEMS_PATH / f"{item_id}.png").is_file() and not valid_png(ITEMS_PATH / f"{item_id}.png")
    )
    valid_count = len(item_ids) - len(missing_images) - len(invalid_images)
    print(f"item images: {valid_count}/{len(item_ids)} referenced images are valid PNG files")
    if missing_images:
        failures.append(f"item images: missing {', '.join(missing_images)}")
    if invalid_images:
        failures.append(f"item images: invalid {', '.join(invalid_images)}")

    if failures:
        raise SystemExit("\n".join(failures))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
