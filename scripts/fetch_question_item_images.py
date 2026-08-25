#!/usr/bin/env python3
"""Download only the real Pokopia item images used by the quiz cards.

The quiz serves these local copies and never asks visitors' browsers to hotlink
the catalogue. Review the selected cards in app/data/item-questions.ts before
refreshing them.
"""

from __future__ import annotations

import argparse
import re
from pathlib import Path
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]
QUESTION_PATH = ROOT / "app" / "data" / "item-questions.ts"
BASE_URL = "https://pokopia.gamertw.com/images/items/{item_id}.png"
USER_AGENT = "PokopiaPreferenceTest/0.2 (non-commercial item-card refresh)"


def download(url: str) -> bytes:
    request = Request(url, headers={"User-Agent": USER_AGENT})
    with urlopen(request, timeout=30) as response:
        if response.headers.get_content_type() != "image/png":
            raise ValueError(f"Expected PNG, received {response.headers.get_content_type()}")
        return response.read()


def item_ids() -> tuple[str, ...]:
    source = QUESTION_PATH.read_text(encoding="utf-8")
    return tuple(dict.fromkeys(re.findall(r"(?:item\('|\{ id: ')([^']+)'", source)))


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=ROOT / "app" / "assets" / "items")
    parser.add_argument("--refresh", action="store_true")
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    selected_ids = item_ids()
    for item_id in selected_ids:
        target = args.output / f"{item_id}.png"
        if target.exists() and not args.refresh:
            print(f"Cached {item_id}")
            continue
        target.write_bytes(download(BASE_URL.format(item_id=item_id)))
        print(f"Downloaded {item_id}")
    print(f"Prepared {len(selected_ids)} item images in {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
