#!/usr/bin/env python3
"""生成 fontMetrics.ts 的字形 ink 度量条目。

用法：
    python3 scripts/gen-font-metrics.py <key> <font-path> [chars...]

输出可直接粘贴进 src/lib/plate/fontMetrics.ts 的对象条目。
依赖 fontTools（pip install fonttools）。
"""

import sys
from fontTools.pens.boundsPen import BoundsPen
from fontTools.ttLib import TTFont

DEFAULT_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-· .'


def main() -> None:
    key = sys.argv[1]
    path = sys.argv[2]
    chars = sys.argv[3] if len(sys.argv) > 3 else DEFAULT_CHARS

    font = TTFont(path)
    upem = font["head"].unitsPerEm
    cmap = font.getBestCmap()
    hmtx = font["hmtx"]
    glyphset = font.getGlyphSet()

    lines = [f"  {key}: {{", f"    upem: {upem},", "    glyphs: {"]
    for ch in chars:
        name = cmap.get(ord(ch))
        if name is None:
            continue
        adv = hmtx[name][0] / upem
        pen = BoundsPen(glyphset)
        glyphset[name].draw(pen)
        if pen.bounds is None:
            lines.append(f"      {ch!r}: {{ adv: {adv:.5f} }},")
            continue
        x0, y0, x1, y1 = pen.bounds
        lines.append(
            "      {ch!r}: {{ adv: {adv:.5f}, x0: {x0:.5f}, y0: {y0:.5f}, x1: {x1:.5f}, y1: {y1:.5f} }},".format(
                ch=ch,
                adv=adv,
                x0=x0 / upem,
                y0=y0 / upem,
                x1=x1 / upem,
                y1=y1 / upem,
            )
        )
    lines.append("    },")
    lines.append("  },")
    print("\n".join(lines))


if __name__ == "__main__":
    main()
