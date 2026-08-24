#!/usr/bin/env python3
"""Fast, dependency-free checks for the generated Pokopia result pool."""

from __future__ import annotations

import json
from pathlib import Path


EXPECTED_GROUPS = {"base": 308, "basin": 52, "event": 5}
REQUIRED_MYTHICAL_IDS = {"mew", "manaphy", "jirachi"}
VALID_FLAVORS = {"甜", "酸", "辣", "苦", "涩"}
VALID_ENVIRONMENTS = {"明亮", "湿润", "温暖", "干燥", "昏暗", "凉爽"}


def main() -> int:
    payload = json.loads(Path("data/pokemon.catalogue.json").read_text(encoding="utf-8"))
    records = payload["records"]
    assert payload["record_count"] == 365 == len(records), "Expected exactly 365 catalogue records"
    assert payload["group_counts"] == EXPECTED_GROUPS, f"Unexpected group counts: {payload['group_counts']}"
    assert not any(payload["unmapped_source_labels"].values()), "Source vocabulary still has unmapped labels"
    assert REQUIRED_MYTHICAL_IDS.issubset({record["id"] for record in records}), "Missing mythical examples"
    for record in records:
        assert record["environment"] in VALID_ENVIRONMENTS | {None}, f"Bad environment: {record['id']}"
        assert isinstance(record["specialties"], list), f"Bad specialty field: {record['id']}"
        assert isinstance(record["favorites"], list), f"Bad favorite field: {record['id']}"
        assert record["flavor"] in VALID_FLAVORS | {None}, f"Bad flavor: {record['id']}"
    print("Catalogue validation passed: 365 entries, all groups, all labels, and mythical examples are present.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
