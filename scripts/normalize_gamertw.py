#!/usr/bin/env python3
"""Turn cached Pokopia wiki pages into a reviewable JSON data set."""

from __future__ import annotations

import argparse
import html
import json
import re
from html.parser import HTMLParser
from pathlib import Path

SPECIALTIES = [
    "瞬間移動", "回收利用", "帶動氣氛", "收藏家", "貪吃鬼", "稀有化",
    "採蜜", "重踏", "點火", "伐木", "碾壓", "夢島", "工匠", "爆炸",
    "飛翔", "分類", "發電", "栽培", "發光", "亂撒", "彩繪", "開派對",
    "擦亮", "找東西", "收納", "交易", "變身", "滋潤", "哈欠", "建造", "鑑定", "DJ",
]

SPECIALTY_MAP = {
    "鑑定": "鉴定", "建造": "建造", "重踏": "重踏", "點火": "点火",
    "伐木": "伐木", "收藏家": "收藏家", "碾壓": "碾压", "DJ": "DJ",
    "夢島": "梦岛", "貪吃鬼": "贪吃鬼", "工匠": "工匠", "爆炸": "爆炸",
    "飛翔": "飞翔", "分類": "分类", "採蜜": "采蜜", "發電": "发电",
    "栽培": "栽培", "帶動氣氛": "带动气氛", "發光": "发光",
    "亂撒": "乱撒", "彩繪": "彩绘", "開派對": "开派对",
    "稀有化": "稀有化", "回收利用": "回收利用", "擦亮": "擦亮",
    "找東西": "找东西", "收納": "收纳", "瞬間移動": "瞬间移动",
    "交易": "交易", "變身": "变身", "滋潤": "滋润", "哈欠": "哈欠",
}

FAVORITES = {
    "色彩繽紛的": "缤纷",
    "艱深難懂的": "知识",
    "以電力驅動的": "机械",
    "集聚在一起的": "热闹",
    "能治癒傷口的": "疗愈",
    "能感受大自然的": "自然",
    "能感受水的": "水",
    "能感受火的": "火",
    "能感受土的": "大地",
    "能感受風的": "风",
    "能感受海的": "海",
    "會發出聲響的": "音乐",
    "大家一起用的": "共享",
    "花朵綻放的": "花朵",
    "圓滾滾的": "圆润",
    "閃亮亮的": "闪亮",
    "會旋轉的": "旋转",
    "會搖晃的": "摇摆",
    "觀賞用的": "观赏",
    "有文字的": "文字",
    "有玻璃的": "玻璃",
    "金屬的": "金属",
    "堅硬的": "坚硬",
    "柔軟的": "柔软",
    "細長的": "细长",
    "尖尖的": "尖尖",
    "詭異的": "诡异",
    "奇妙的": "奇妙",
    "石製的": "石制",
    "木製的": "木制",
    "布製的": "布艺",
    "可愛的": "可爱",
    "整潔的": "整洁",
    "方方的": "方方",
    "垃圾": "垃圾",
    "建設": "建设",
    "容器": "容器",
    "訓練用的": "运动",
    "像食物的": "美食",
    "豪華的": "豪华",
    "遊戲區": "玩乐",
    "交通工具": "交通工具",
    "象徵": "象征",
    "甜甜的": "甜",
    "酸酸的": "酸",
    "辣辣的": "辣",
    "苦苦的": "苦",
    "澀澀的": "涩",
}

ENVIRONMENT_MAP = {
    "明亮": "明亮",
    "潮濕": "湿润",
    "溫暖": "温暖",
    "乾燥": "干燥",
    "黑暗": "昏暗",
    "涼爽": "凉爽",
}


class TextExtractor(HTMLParser):
    BLOCK_TAGS = {"p", "div", "section", "article", "h1", "h2", "h3", "li", "tr", "br"}

    def __init__(self) -> None:
        super().__init__()
        self.parts: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in self.BLOCK_TAGS:
            self.parts.append("\n")

    def handle_endtag(self, tag: str) -> None:
        if tag in self.BLOCK_TAGS:
            self.parts.append("\n")

    def handle_data(self, data: str) -> None:
        self.parts.append(data)


def visible_lines(page: str) -> list[str]:
    parser = TextExtractor()
    parser.feed(page)
    lines: list[str] = []
    for raw_line in html.unescape("".join(parser.parts)).splitlines():
        line = re.sub(r"\s+", " ", raw_line).strip()
        if line and (not lines or lines[-1] != line):
            lines.append(line)
    return lines


def first_between(lines: list[str], start: str, end_markers: tuple[str, ...]) -> list[str]:
    try:
        start_index = lines.index(start) + 1
    except ValueError:
        return []
    values: list[str] = []
    for line in lines[start_index:]:
        if any(marker in line for marker in end_markers):
            break
        values.append(re.sub(r"\s*\(\d+\)$", "", line))
    return [value for value in values if value not in {"Image", "Pokopia 攻略 Wiki"}]


def split_known_terms(raw_values: list[str], labels: list[str]) -> list[str]:
    """Split site text where adjacent anchor labels are emitted without spaces."""
    source = "".join(raw_values)
    labels = sorted(labels, key=len, reverse=True)
    output: list[str] = []
    index = 0
    while index < len(source):
        matched = next((label for label in labels if source.startswith(label, index)), None)
        if matched:
            output.append(matched)
            index += len(matched)
        else:
            index += 1
    return output


def extract_record(slug: str, source_url: str, page: str, catalogue: dict[str, object]) -> dict[str, object] | None:
    lines = visible_lines(page)
    h1 = re.search(r"<h1[^>]*>(.*?)</h1>", page, flags=re.S | re.I)
    if not h1:
        return None
    name = re.sub(r"<[^>]+>", "", h1.group(1)).strip()
    dex_match = re.search(r"#(\d{1,3})", "\n".join(lines[:80]))
    dex_no = catalogue.get("dexNo") or (int(dex_match.group(1)) if dex_match else None)
    if not name or not isinstance(dex_no, int):
        return None
    reject = {"返回寶可夢列表", "主要地點:", "世代:"}
    environment = [ENVIRONMENT_MAP.get(item, item) for item in first_between(lines, "理想環境", ("專長", "喜好"))[:1]]
    specialty_raw = [item for item in first_between(lines, "專長", ("喜好", "棲息地")) if item not in reject]
    favorite_raw = [item for item in first_between(lines, "喜好", ("棲息地", "喜好與", "喜愛的道具")) if item not in reject]
    specialties = [SPECIALTY_MAP[item] for item in split_known_terms(specialty_raw, SPECIALTIES)][:2]
    all_favorites = [FAVORITES[item] for item in split_known_terms(favorite_raw, list(FAVORITES))]
    flavor = next((item for item in all_favorites if item in {"甜", "酸", "辣", "苦", "涩"}), None)
    favorites = [item for item in all_favorites if item != flavor][:6]
    return {
        "id": slug,
        "dexNo": dex_no,
        "catalogueNo": catalogue.get("catalogueNo", dex_no),
        "group": catalogue.get("group", "main"),
        "types": catalogue.get("types", []),
        "name": name,
        "environment": environment,
        "specialties": specialties,
        "favorites": favorites,
        "flavor": flavor,
        "source": source_url,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, default=Path("data/raw/gamertw"))
    parser.add_argument("--output", type=Path, default=Path("data/pokemon.generated.json"))
    args = parser.parse_args()
    manifest_path = args.input / "manifest.json"
    if not manifest_path.exists():
        raise SystemExit("No manifest found. Run scripts/fetch_gamertw.py first.")

    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    records: list[dict[str, object]] = []
    failures: list[str] = []
    for page in manifest["pages"]:
        if page.get("state") == "failed":
            failures.append(page["slug"])
            continue
        html_path = args.input / page["file"]
        if not html_path.exists():
            failures.append(page["slug"])
            continue
        record = extract_record(page["slug"], page["url"], html_path.read_text(encoding="utf-8"), page.get("catalogue", {}))
        if record is None:
            failures.append(page["slug"])
        else:
            records.append(record)

    records.sort(key=lambda record: (record.get("catalogueNo", record["dexNo"]), record["id"]))
    payload = {
        "generated_from": manifest["source"],
        "source_fetched_at": manifest["fetched_at"],
        "records": records,
        "review": {"parsed_count": len(records), "failed_slugs": failures, "note": "Review this file before publishing it as app data."},
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Parsed {len(records)} records; {len(failures)} need review. Wrote {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
