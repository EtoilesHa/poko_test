#!/usr/bin/env python3
"""Fetch the public Pokopia catalogue into a local, auditable cache.

The deployed quiz never calls this source. Run this deliberately when refreshing
the local data set, keep the default throttle, and review generated files.
"""

from __future__ import annotations

import argparse
import json
import re
import time
from datetime import UTC, datetime
from pathlib import Path
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen

DEFAULT_INDEX = "https://pokopia.gamertw.com/zh-TW/pokemon"
USER_AGENT = "PokopiaPreferenceTest/0.1 (non-commercial data review)"


def download(url: str) -> str:
    request = Request(url, headers={"User-Agent": USER_AGENT, "Accept-Language": "zh-TW,zh;q=0.9"})
    with urlopen(request, timeout=30) as response:
        return response.read().decode("utf-8", errors="replace")


def pokemon_urls(index_html: str, index_url: str) -> list[str]:
    matches = re.findall(r'href=["\']([^"\']*/zh-TW/pokemon/[^"\'#?]+)["\']', index_html)
    seen: set[str] = set()
    urls: list[str] = []
    for match in matches:
        url = urljoin(index_url, match)
        if url in seen or urlparse(url).netloc != urlparse(index_url).netloc:
            continue
        seen.add(url)
        urls.append(url)
    return urls


def slug_for(url: str) -> str:
    return urlparse(url).path.rstrip("/").split("/")[-1]


def json_value_at(text: str, start: int) -> str:
    """Return a balanced JSON object starting at start (without trusting page markup)."""
    depth = 0
    quoted = False
    escaped = False
    for index in range(start, len(text)):
        char = text[index]
        if quoted:
            if escaped:
                escaped = False
            elif char == "\\\\":
                escaped = True
            elif char == '"':
                quoted = False
            continue
        if char == '"':
            quoted = True
        elif char in "{[":
            depth += 1
        elif char in "}]":
            depth -= 1
            if depth == 0:
                return text[start:index + 1]
    raise ValueError("Unclosed JSON payload")


def catalogue_metadata(index_html: str) -> dict[str, dict[str, object]]:
    """Read the rendered catalogue payload for section, order, types, and Chinese name."""
    scripts = re.findall(r'self\.__next_f\.push\(\[1,"(.*?)"\]\)</script>', index_html, flags=re.S)
    for encoded in scripts:
        try:
            decoded = json.loads(f'"{encoded}"')
        except json.JSONDecodeError:
            continue
        marker = '{"pokemon":['
        start = decoded.find(marker)
        if start == -1:
            continue
        try:
            payload = json.loads(json_value_at(decoded, start))
        except (json.JSONDecodeError, ValueError):
            continue
        result: dict[str, dict[str, object]] = {}
        for pokemon in payload.get("pokemon", []):
            pokemon_id = pokemon.get("id")
            if isinstance(pokemon_id, str):
                result[pokemon_id] = {
                    "group": pokemon.get("dex", "main"),
                    "dexNo": pokemon.get("dexNo"),
                    "catalogueNo": pokemon.get("dexNumber"),
                    "types": pokemon.get("types", []),
                    "name": pokemon.get("name"),
                    "favorites": pokemon.get("favorites", []),
                    "specialties": pokemon.get("specialties", []),
                    "idealHabitat": pokemon.get("idealHabitat"),
                }
        if result:
            return result
    return {}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--index-url", default=DEFAULT_INDEX)
    parser.add_argument("--output", type=Path, default=Path("data/raw/gamertw"))
    parser.add_argument("--delay", type=float, default=0.8, help="Seconds between requests; keep this polite.")
    parser.add_argument("--limit", type=int, default=0, help="For a smoke test, fetch only N detail pages.")
    parser.add_argument("--refresh", action="store_true", help="Re-fetch already cached pages.")
    args = parser.parse_args()

    args.output.mkdir(parents=True, exist_ok=True)
    index_path = args.output / "pokemon-index.html"
    if args.refresh or not index_path.exists():
        print(f"Downloading index: {args.index_url}")
        index_path.write_text(download(args.index_url), encoding="utf-8")
    index_html = index_path.read_text(encoding="utf-8")
    urls = pokemon_urls(index_html, args.index_url)
    metadata = catalogue_metadata(index_html)
    if not metadata:
        print("Warning: catalogue metadata not found; detail pages will still be cached.")
    if args.limit:
        urls = urls[:args.limit]
    print(f"Found {len(urls)} Pokémon detail pages.")

    manifest = {"source": args.index_url, "fetched_at": datetime.now(UTC).isoformat(), "pages": []}
    for position, url in enumerate(urls, start=1):
        slug = slug_for(url)
        target = args.output / f"{slug}.html"
        state = "cached"
        try:
            if args.refresh or not target.exists():
                print(f"[{position}/{len(urls)}] Downloading {slug}")
                target.write_text(download(url), encoding="utf-8")
                state = "downloaded"
                time.sleep(args.delay)
            manifest["pages"].append({"slug": slug, "url": url, "file": target.name, "state": state, "catalogue": metadata.get(slug, {})})
        except Exception as error:
            print(f"[{position}/{len(urls)}] FAILED {slug}: {error}")
            manifest["pages"].append({"slug": slug, "url": url, "file": target.name, "state": "failed", "error": str(error), "catalogue": metadata.get(slug, {})})

    (args.output / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Saved cache and manifest to {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
