/**
 * 布局引擎单元测试。
 *
 * 验证 mm 精确布局的核心不变量：
 * - 字符步进 = advance + gap（含 gapAfter 覆盖）
 * - 居中对齐时序列整体居中、末尾不留 gap
 * - glyphTransform 把 ink box 精确拟合到 mm 单元格
 */

import { describe, expect, it } from 'vitest';
import { glyphTransform, layoutFreeRun, layoutRun, pitchOf } from '@/lib/plate/layout';
import { cnStandard } from '@/lib/standards/cn';
import { FONT_METRICS } from '@/lib/plate/fontMetrics';
import { usStandard } from '@/lib/standards/us';
import { getPlateType } from '@/lib/standards';
import type { CharClass, PlateType } from '@/types/standard';

const smallCar = getPlateType('cn-small-car');

describe('pitchOf', () => {
  it('advance 缺省时回退到 width', () => {
    const cls: CharClass = {
      id: 'x', height: 70, width: 45, fit: 'fill',
      fill: { kind: 'solid', color: '#000' },
      font: { family: 'ChePaiZiTi', src: '' },
    };
    expect(pitchOf(cls)).toBe(45);
    expect(pitchOf({ ...cls, advance: 30 })).toBe(30);
  });
});

describe('layoutRun（中国小型汽车 京A00001）', () => {
  const values = { province: '京', letter: 'A', serial: '00001' };
  const placed = layoutRun(smallCar.runs[0] as never, smallCar, values);

  it('生成 7 个字位（省+字母+5序号）', () => {
    expect(placed).toHaveLength(7);
    expect(placed.every((g) => g !== null)).toBe(true);
  });

  it('字符宽度符合图1（汉字/字母/数字均为 45mm 单元格）', () => {
    expect(placed[0]!.cell.w).toBe(45); // 京
    expect(placed[1]!.cell.w).toBe(45); // A
    expect(placed[2]!.cell.w).toBe(45); // 0
  });

  it('字符高度符合图1（汽车类 90mm）', () => {
    for (const g of placed) expect(g!.cell.h).toBe(90);
  });

  it('居中对齐：序列首尾相对牌面中线对称', () => {
    const W = smallCar.size.width;
    const first = placed[0]!.cell.x;
    const last = placed[6]!;
    const lastRight = last.cell.x + last.cell.w;
    const leftMargin = first;
    const rightMargin = W - lastRight;
    // 居中 → 左右留白相等（容差 0.5mm）
    expect(Math.abs(leftMargin - rightMargin)).toBeLessThan(0.5);
  });

  it('相邻字符步进 = advance + gapAfter（图1：45+12；分隔点区 45+34）', () => {
    // 京(45, gapAfter 12) → A：x 差 = 45+12 = 57
    expect(placed[1]!.cell.x - placed[0]!.cell.x).toBeCloseTo(57, 3);
    // A(45, gapAfter 34，含分隔点) → 0：x 差 = 45+34 = 79
    expect(placed[2]!.cell.x - placed[1]!.cell.x).toBeCloseTo(79, 3);
    // 0(45, gapAfter 12) → 0：x 差 = 57
    expect(placed[3]!.cell.x - placed[2]!.cell.x).toBeCloseTo(57, 3);
  });
});

describe('layoutRun（字段值不足时留空）', () => {
  it('serial 只有 3 位时，后两个槽位为 null', () => {
    const placed = layoutRun(smallCar.runs[0] as never, smallCar, {
      province: '京', letter: 'A', serial: '000',
    });
    // 槽位序：[省, 字母, s0, s1, s2, s3, s4] → serial '000' 只填前 3 个
    expect(placed[2]!.char).toBe('0'); // s0
    expect(placed[4]!.char).toBe('0'); // s2
    expect(placed[5]).toBeNull(); // s3 缺
    expect(placed[6]).toBeNull(); // s4 缺
  });
});

describe('layoutFreeRun（美国 ABC-1234 居中）', () => {
  const us = getPlateType('us-standard');
  const placed = layoutFreeRun(us.runs[0] as never, us, { code: 'ABC-1234' });

  it('展开为 8 个字符（含连字符）', () => {
    expect(placed.filter(Boolean)).toHaveLength(8);
    expect(placed.map((g) => g?.char).join('')).toBe('ABC-1234');
  });

  it('连字符用 other 类，数字用 digit 类', () => {
    expect(placed[3]!.cls.id).toBe('other'); // '-'
    expect(placed[4]!.cls.id).toBe('digit'); // '1'
  });

  it('居中：左右留白对称', () => {
    const W = us.size.width;
    const first = placed[0]!.cell.x;
    const last = placed[7]!;
    const rightMargin = W - (last.cell.x + last.cell.w);
    expect(Math.abs(first - rightMargin)).toBeLessThan(0.5);
  });
});

describe('layoutFreeRun 右对齐（日本一连番号）', () => {
  const jp = getPlateType('jp-private-mid');
  const serialRun = jp.runs.find((r) => r.kind === 'free' && r.field === 'serial')!;
  const placed = layoutFreeRun(serialRun as never, jp, { serial: '12-34' });

  it('序列右缘贴合对齐框右缘', () => {
    const last = placed[placed.length - 1]!;
    const rightEdge = last.cell.x + last.cell.w;
    const boxRight = (serialRun as { width?: number }).width ?? jp.size.width;
    expect(rightEdge).toBeCloseTo(boxRight, 0);
  });
});

describe('glyphTransform（ink 精确拟合）', () => {
  it('等比模式：ink 高精确等于单元格高，且各字保持自然宽度', () => {
    const cls: CharClass = smallCar.charClasses.serial;
    const cell = { x: 100, y: 25, w: 45, h: 90 };
    const { transform, fontSize } = glyphTransform('0', cls, cell);
    // fontSize = 1（em 基准），transform 含 translate + scale
    expect(fontSize).toBe(1);
    expect(transform).toMatch(/^translate\(/);
    expect(transform).toMatch(/scale\(/);
    // '0' 的 ink 高取自字体度量（不同字体不同）
    const zero = FONT_METRICS.CNPlate.glyphs['0'];
    const inkH = zero.y1! - zero.y0!;
    const sy = parseFloat(transform.match(/scale\(([-\d.]+)\s+([-\d.]+)\)/)![2]);
    expect(sy * inkH).toBeCloseTo(90, 0);
    // 等比模式下 '1' 不被拉宽：横向缩放与纵向一致，宽度由字形决定
    const one = glyphTransform('1', cls, cell);
    const m = one.transform.match(/scale\(([-\d.]+)\s+([-\d.]+)\)/)!;
    expect(parseFloat(m[1])).toBeCloseTo(parseFloat(m[2]), 3);
  });

  it('无 ink 字形（空格）仅定位不缩放', () => {
    const cls: CharClass = smallCar.charClasses.serial;
    const cell = { x: 10, y: 25, w: 45, h: 90 };
    const { transform } = glyphTransform(' ', cls, cell);
    expect(transform).not.toMatch(/scale\(/);
    expect(transform).toMatch(/translate\(10 /);
  });
});

describe('标准注册表完整性', () => {
  it('中国 20 类版式齐全（表1 全部类别，含前后号牌与摩托系列）', () => {
    expect(cnStandard.types.length).toBe(20);
  });

  it('普通摩托车为一字两行版式（图9）', () => {
    const moto = getPlateType('cn-moto');
    expect(moto.size).toEqual({ width: 220, height: 140 });
    expect(moto.runs).toHaveLength(2);
  });

  it('每个类型都有 citation、fields、defaults', () => {
    for (const std of [cnStandard, usStandard]) {
      for (const t of std.types) {
        expect(t.citation).toBeTruthy();
        expect(t.fields.length).toBeGreaterThan(0);
        expect(Object.keys(t.defaults).length).toBeGreaterThan(0);
      }
    }
  });

  it('每个 run 引用的 charClass 都存在', () => {
    for (const t of [smallCar, ...usStandard.types, ...cnStandard.types] as PlateType[]) {
      for (const run of t.runs) {
        if (run.kind === 'run') {
          for (const s of run.slots) expect(t.charClasses[s.classId]).toBeTruthy();
        } else {
          expect(t.charClasses[run.auto.digit]).toBeTruthy();
          expect(t.charClasses[run.auto.letter]).toBeTruthy();
          expect(t.charClasses[run.auto.other]).toBeTruthy();
        }
      }
    }
  });
});
