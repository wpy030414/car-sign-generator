#!/usr/bin/env python3
"""按号牌用字集子集化字体，输出 woff2（屏幕加载 + 导出内联共用）。

用法：
    python3 -m pip install fonttools brotli
    python3 scripts/subset-fonts.py

字体按**使用国家/地区**命名，原始字体名只保留在注释/文档里：

    CN-Plate.woff2       中国 普通号牌（数字/字母/汉字）
    CN-NE-Latin.woff2    中国 新能源号牌拉丁字形
    EU-Plate.woff2       欧盟 注册号 + 空格/连字符（FE-Schrift 克隆 + 标点合并）
    US-Plate.woff2       美国 注册号（FHWA / Roadgeek 字形）
    JP-Plate.woff2       日本 号牌（Noto Sans JP 子集）

欧盟标点原本单独放在 `EU-Punct`，但它只提供空格与连字符；合并进 `EU-Plate`
后少一个字体请求，且两者的字符不冲突（重叠的 A–Z/0–9 保留 FE-Schrift 字形）。

脚本可以重复运行：若原始字体已不在仓库里，会自动以当前 woff2 为输入再子集化
（字符集只能缩小；要新增字符，需先从 git 历史取回原始字体）。

输出：
- `public/fonts/*.woff2`：按号牌字符集裁剪后的字体；
- `src/lib/plate/fontCoverage.generated.ts`：每个字体实际覆盖的字符集，
  供单元测试检查「标准数据新增字符后是否忘了重新子集化」。

说明：字体度量（`fontMetrics.ts`）由原始字体生成，子集化不会改变 upem、
advance 与轮廓，因此度量继续有效。新增固定字面量、省份简称或输入字符集时，
必须同步更新本脚本并重新生成。
"""

from __future__ import annotations

import os
import string
import sys
import tempfile

from fontTools import subset
from fontTools.merge import Merger
from fontTools.ttLib import TTFont
from fontTools.ttLib.scaleUpem import scale_upem

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONT_DIR = os.path.join(ROOT, "public", "fonts")
COVERAGE_OUT = os.path.join(ROOT, "src", "lib", "plate", "fontCoverage.generated.ts")

# 中国号牌：数字 + 大写字母 + 31 个省份简称 + 固定尾缀（使领馆学警港澳挂）
CN_PROV = "京津冀晋蒙辽吉黑沪苏浙皖闽赣鲁豫鄂湘粤桂琼渝川贵云藏陕甘青宁新咕鹿"
CN_CHARS = string.digits + string.ascii_uppercase + CN_PROV + "港澳挂学警使领"

# 中国新能源拉丁字形：源字体实际只有 1–9 与 A–H/L/M/N；按全字母数字请求，
# 缺字自动忽略，方便日后替换为覆盖更全的字体。
CN_NE_CHARS = string.digits + string.ascii_uppercase

# 欧盟：FE-Schrift 克隆负责字母/数字；空格与连字符从 EU-Punct 合并进来。
EU_CHARS = string.digits + string.ascii_uppercase + "ÄÖÜäöü -"

# 美国：Roadgeek 覆盖注册号输入集（含各州版式允许的小写与标点）
US_CHARS = string.ascii_letters + string.digits + " .,'/-"

# 日本：平假名用途文字 + 分类番号字母 + 一连番号数字/连字符/中黒。
# 地名汉字集从现有子集里原样保留（运输支局地名是开放集合）。
JP_KANA = "あいうえかきくけこをさすせそたちつてとなにぬねのはひふほまみむめもやゆらりるろわれ"
# `・`（U+30FB）与 `･`（U+FF65）都保留：Noto 子集里实际字形是半角码位，
# 子集化后把 U+FF65 的字形在 cmap 里别名到 U+30FB（见 alias_cmap）。
JP_CHARS = string.digits + string.ascii_uppercase + " -・･" + JP_KANA

# 字体 family（CSS/渲染层标识）→ 最终文件
FONT_FILES = {
    "CN-Plate": "CN-Plate.woff2",
    "CN-NE-Latin": "CN-NE-Latin.woff2",
    "EU-Plate": "EU-Plate.woff2",
    "US-Plate": "US-Plate.woff2",
    "JP-Plate": "JP-Plate.woff2",
}


def alias_cmap(font, src_cp: int, dst_cp: int) -> None:
    """把 src_cp 的字形同时映射到 dst_cp（用于 U+FF65 → U+30FB 中黒别名）。"""
    for table in font["cmap"].tables:
        if table.isUnicode() and src_cp in table.cmap:
            table.cmap[dst_cp] = table.cmap[src_cp]


def pick_source(sources: tuple[str, ...]) -> str:
    for name in sources:
        path = os.path.join(FONT_DIR, name)
        if os.path.exists(path):
            return path
    sys.exit(
        "缺少源字体（以下任一）：\n  "
        + "\n  ".join(os.path.join(FONT_DIR, s) for s in sources)
        + "\n可从 git 历史取回原始字体后重试，详见脚本头部说明。"
    )


def subset_font(
    src: str,
    dst: str,
    chars: set[str],
    aliases: tuple[int, int] | None = None,
    flavor: str | None = "woff2",
) -> None:
    """把 src 子集化为 chars。src 与 dst 相同时原地重写。"""
    options = subset.Options()
    options.flavor = flavor
    options.hinting = False
    options.desubroutinize = True
    options.layout_features = []  # 号牌逐字渲染，无需 GSUB/GPOS
    options.drop_tables += ["DSIG"]
    font = subset.load_font(src, options)
    subsetter = subset.Subsetter(options=options)
    subsetter.populate(text="".join(sorted(chars)))
    subsetter.subset(font)
    if aliases:
        alias_cmap(font, *aliases)
    subset.save_font(font, dst, options)
    font.close()
    print(
        f"  {os.path.basename(src):32s} → {os.path.basename(dst):24s} "
        f"{os.path.getsize(dst) / 1024:7.1f} KB  ({len(chars)} chars)"
    )


def cmap_chars(path: str) -> set[str]:
    font = TTFont(path)
    chars = {chr(c) for c in font.getBestCmap() if c >= 0x20}
    font.close()
    return chars


def make_eu_plate() -> None:
    """EU-Plate：FE-Schrift 字形 +（首次生成时）从 EU-Punct 合并空格/连字符。

    两者字符集只在 A–Z/0–9 上重叠；合并前先把标点源裁到只剩空格/连字符，
    因此不会出现同码位字形冲突，FE-Schrift 的字母数字始终保留。
    """
    dst = os.path.join(FONT_DIR, "EU-Plate.woff2")
    fe_src = pick_source(("FE-Mittelschrift.ttf", "EU-Plate.woff2"))
    probe = TTFont(fe_src)
    has_punct = 0x2D in probe.getBestCmap() and 0x20 in probe.getBestCmap()
    probe.close()

    if has_punct:
        subset_font(fe_src, dst, set(EU_CHARS))
        return

    punct_src = pick_source(("Latin.ttf", "EU-Punct.woff2"))
    with tempfile.TemporaryDirectory() as tmp:
        fe_sub = os.path.join(tmp, "fe.ttf")
        punct_sub = os.path.join(tmp, "punct.ttf")
        merged = os.path.join(tmp, "eu.ttf")

        subset_font(fe_src, fe_sub, set(EU_CHARS) - set("- "), flavor=None)
        subset_font(punct_src, punct_sub, set("- "), flavor=None)

        # 两个源字体 upem 不同（FE 1000 / Latin 2048）；按 em 比例缩放后合并，
        # 度量仍以 em 分数表示，数值不变。
        upem = TTFont(fe_sub)["head"].unitsPerEm
        punct = TTFont(punct_sub)
        scale_upem(punct, upem)
        punct.save(punct_sub)
        punct.close()

        merged_font = Merger().merge([fe_sub, punct_sub])
        merged_font.save(merged)
        merged_font.close()

        subset_font(merged, dst, set(EU_CHARS))


def main() -> None:
    noto_src = pick_source(("NotoSansJP-Bold-subset.woff2", "JP-Plate.woff2"))
    # 地名汉字：保留现有子集里的全部 CJK 统一表意文字
    noto_chars = set(JP_CHARS) | {
        ch for ch in cmap_chars(noto_src) if "一" <= ch <= "鿿"
    }

    print("子集化字体：")
    make_eu_plate()

    # (候选源文件（原始名优先，其次当前产物）, 目标文件, 字符集, cmap 别名)
    jobs = [
        (("CN.ttf", "CN-Plate.woff2"), "CN-Plate.woff2", set(CN_CHARS), None),
        (("CN-NE-Latin.otf", "CN-E-Latin.otf", "CN-NE-Latin.woff2"), "CN-NE-Latin.woff2", set(CN_NE_CHARS), None),
        (("Roadgeek-2014-EM.ttf", "US-Plate.woff2"), "US-Plate.woff2", set(US_CHARS), None),
        (
            ("NotoSansJP-Bold-subset.woff2", "JP-Plate.woff2"),
            "JP-Plate.woff2",
            noto_chars,
            (0xFF65, 0x30FB),
        ),
    ]

    superseded: list[str] = []
    for sources, dst_name, chars, aliases in jobs:
        src = pick_source(sources)
        subset_font(src, os.path.join(FONT_DIR, dst_name), chars, aliases)
        for name in sources:
            if name != dst_name and os.path.exists(os.path.join(FONT_DIR, name)):
                superseded.append(name)

    # 生成覆盖清单（供单测）：以最终文件为准，而不是脚本里的字符集
    coverage: dict[str, str] = {}
    for family, file_name in FONT_FILES.items():
        path = os.path.join(FONT_DIR, file_name)
        if not os.path.exists(path):
            sys.exit(f"缺少字体：{path}")
        coverage[family] = "".join(sorted(cmap_chars(path), key=ord))

    def ts_string(text: str) -> str:
        # 与仓库格式化器保持一致：含单引号且不含双引号时优先用双引号，避免转义
        if "'" in text and '"' not in text:
            return '"' + text.replace("\\", "\\\\") + '"'
        return "'" + text.replace("\\", "\\\\").replace("'", "\\'") + "'"

    lines = [
        "// 生成物，勿手改。由 scripts/subset-fonts.py 生成。",
        "// 记录每个字体子集实际覆盖的字符，供 fontCoverage.test.ts 校验。",
        "export const FONT_COVERAGE = {",
    ]
    for family, chars in coverage.items():
        entry = f"  {ts_string(family)}: {ts_string(chars)},"
        if len(entry) <= 90:
            lines.append(entry)
        else:
            lines.append(f"  {ts_string(family)}:")
            lines.append(f"    {ts_string(chars)},")
    lines.append("} as const;")
    lines.append("")
    with open(COVERAGE_OUT, "w", encoding="utf-8") as fh:
        fh.write("\n".join(lines))
    print(f"\n覆盖清单 → {os.path.relpath(COVERAGE_OUT, ROOT)}")

    # EU-Punct 已合并进 EU-Plate；其余原始字体也已被 woff2 取代
    legacy = ["EU-Punct.woff2", "Latin.ttf", "FE-Mittelschrift.ttf"]
    superseded.extend(name for name in legacy if os.path.exists(os.path.join(FONT_DIR, name)))
    if superseded:
        print("\n已被合并/取代的源文件（确认无误后可删除）：")
        for name in sorted(set(superseded)):
            print(f"  public/fonts/{name}")


if __name__ == "__main__":
    main()
