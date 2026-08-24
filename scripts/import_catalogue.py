#!/usr/bin/env python3
"""Build app-ready Pokopia preference data from the cached public catalogue.

The catalogue contains all base, Bubbly Basin DLC, and event entries in one
rendered payload.  Keeping the extraction here makes the generated JSON and
TypeScript files deterministic and easy to audit before publishing.
"""

from __future__ import annotations

import argparse
import json
from collections import Counter
from pathlib import Path

from fetch_gamertw import catalogue_metadata


TYPE_MAP = {
    "Bug": "虫", "Dark": "恶", "Dragon": "龙", "Electric": "电", "Fairy": "妖精",
    "Fighting": "格斗", "Fire": "火", "Flying": "飞行", "Ghost": "幽灵", "Grass": "草",
    "Ground": "地面", "Ice": "冰", "Normal": "一般", "Poison": "毒", "Psychic": "超能力",
    "Rock": "岩石", "Steel": "钢", "Water": "水",
}

FAVORITE_MAP = {
    "colorful stuff": "缤纷", "complicated stuff": "知识", "electronics": "机械",
    "gatherings": "共享", "group activities": "热闹", "healing": "疗愈",
    "lots of nature": "自然", "lots of water": "水", "lots of fire": "火",
    "lots of dirt": "大地", "nice breezes": "风", "ocean vibes": "海",
    "noisy stuff": "音乐", "pretty flowers": "花朵", "round stuff": "圆润",
    "shiny stuff": "闪亮", "spinning stuff": "旋转", "wobbly stuff": "摇摆",
    "watching stuff": "观赏", "letters and words": "文字", "glass stuff": "玻璃",
    "metal stuff": "金属", "hard stuff": "坚硬", "soft stuff": "柔软",
    "slender objects": "细长", "sharp stuff": "尖尖", "spooky stuff": "诡异",
    "strange stuff": "奇妙", "stone stuff": "石制", "wooden stuff": "木制",
    "fabric": "布艺", "cute stuff": "可爱", "cleanliness": "整洁", "blocky stuff": "方方",
    "garbage": "垃圾", "construction": "建设", "containers": "容器", "exercise": "运动",
    "looks like food": "美食", "luxury": "豪华", "play spaces": "玩乐", "rides": "交通工具",
    "symbols": "象征",
}

FLAVOR_MAP = {
    "sweet flavors": "甜", "sour flavors": "酸", "spicy flavors": "辣",
    "bitter flavors": "苦", "dry flavors": "涩",
}

SPECIALTY_MAP = {
    "appraise": "鉴定", "collect": "收藏家", "crush": "重踏", "dj": "DJ",
    "dream island": "梦岛", "eat": "贪吃鬼", "engineer": "工匠", "explode": "爆炸",
    "fly": "飞翔", "gather honey": "采蜜", "illuminate": "发光", "paint": "彩绘",
    "party": "开派对", "rarify": "稀有化", "storage": "收纳", "transform": "变身", "yawn": "哈欠",
    "build": "建造", "bulldoze": "碾压", "burn": "点火", "chop": "伐木",
    "craft": "工匠", "flight": "飞翔", "gather": "收纳", "generate": "发电",
    "grow": "栽培", "hype": "带动气氛", "litter": "乱撒", "recycle": "回收利用",
    "scrub": "擦亮", "search": "找东西", "teleport": "瞬间移动", "trade": "交易",
    "water": "滋润",
}

ENVIRONMENT_MAP = {
    "bright": "明亮", "humid": "湿润", "warm": "温暖", "dry": "干燥",
    "dark": "昏暗", "cool": "凉爽",
}

GROUP_MAP = {"main": "base", "basin": "basin", "event": "event"}


def lowered(value: object) -> str:
    return str(value).strip().casefold()


def build_records(catalogue: dict[str, dict[str, object]]) -> tuple[list[dict[str, object]], dict[str, list[str]]]:
    unknown = {"favorites": set(), "specialties": set(), "environments": set(), "types": set()}
    records: list[dict[str, object]] = []
    for pokemon_id, raw in catalogue.items():
        raw_favorites = [lowered(item) for item in raw.get("favorites", []) if isinstance(item, str)]
        flavor = next((FLAVOR_MAP[item] for item in raw_favorites if item in FLAVOR_MAP), None)
        favorites: list[str] = []
        for item in raw_favorites:
            if item in FLAVOR_MAP:
                continue
            mapped = FAVORITE_MAP.get(item)
            if mapped:
                favorites.append(mapped)
            else:
                unknown["favorites"].add(item)
        raw_specialties = [lowered(item) for item in raw.get("specialties", []) if isinstance(item, str)]
        specialties = []
        for item in raw_specialties:
            mapped = SPECIALTY_MAP.get(item)
            if mapped:
                specialties.append(mapped)
            else:
                unknown["specialties"].add(item)
        raw_environment = lowered(raw.get("idealHabitat", ""))
        environment = ENVIRONMENT_MAP.get(raw_environment)
        if raw_environment and not environment:
            unknown["environments"].add(raw_environment)
        types = []
        for item in raw.get("types", []):
            mapped = TYPE_MAP.get(str(item))
            if mapped:
                types.append(mapped)
            else:
                unknown["types"].add(str(item))
        name = str(raw.get("name") or pokemon_id)
        group = GROUP_MAP.get(str(raw.get("group")), "base")
        favourite_phrase = "、".join(favorites[:2]) or "独特气场"
        records.append({
            "id": pokemon_id,
            "dexNo": int(raw.get("dexNo") or 0),
            "catalogueNo": int(raw.get("catalogueNo") or 0),
            "name": name,
            "group": group,
            "types": types,
            "specialties": specialties,
            "environment": environment,
            "favorites": favorites[:6],
            "flavor": flavor,
            "tagline": f"你的「{favourite_phrase}」雷达已和{name}对频：这位邻居想给你留一盏灯。",
            "shareLine": f"我的 Pokopia 命定宝可梦是{name}！{favourite_phrase}党，今日正式入驻。",
            "source": f"https://pokopia.gamertw.com/zh-TW/pokemon/{pokemon_id}",
        })
    records.sort(key=lambda item: (item["catalogueNo"], item["id"]))
    return records, {key: sorted(values) for key, values in unknown.items()}


def as_typescript(records: list[dict[str, object]]) -> str:
    compact = []
    for item in records:
        copy = {key: value for key, value in item.items() if key not in {"catalogueNo", "source"}}
        compact.append(copy)
    return "// Generated by scripts/import_catalogue.py. Do not edit by hand.\n" + "import type { Pokemon } from './types';\n\n" + f"export const POKEMON: Pokemon[] = {json.dumps(compact, ensure_ascii=False, separators=(',', ':'))};\n"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--index", type=Path, default=Path("data/raw/gamertw/pokemon-index.html"))
    parser.add_argument("--json-output", type=Path, default=Path("data/pokemon.catalogue.json"))
    parser.add_argument("--ts-output", type=Path, default=Path("app/data/pokemon.generated.ts"))
    args = parser.parse_args()
    if not args.index.exists():
        raise SystemExit("No cached index found. Run scripts/fetch_gamertw.py --limit 1 first.")
    catalogue = catalogue_metadata(args.index.read_text(encoding="utf-8"))
    if not catalogue:
        raise SystemExit("Could not find the catalogue payload in the cached index.")
    records, unknown = build_records(catalogue)
    args.json_output.parent.mkdir(parents=True, exist_ok=True)
    args.ts_output.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "source": "https://pokopia.gamertw.com/zh-TW/pokemon",
        "record_count": len(records),
        "group_counts": dict(Counter(record["group"] for record in records)),
        "records": records,
        "unmapped_source_labels": unknown,
    }
    args.json_output.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    args.ts_output.write_text(as_typescript(records), encoding="utf-8")
    print(f"Built {len(records)} records: {payload['group_counts']}. Wrote {args.json_output} and {args.ts_output}")
    if any(unknown.values()):
        print("Unmapped labels:", json.dumps(unknown, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
