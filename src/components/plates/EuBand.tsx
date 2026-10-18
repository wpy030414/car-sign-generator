/**
 * 欧盟蓝带装饰组件。
 *
 * 绘制：左侧 Reflex Blue 竖带（带右侧圆角跟随牌体）+ 12 星环（Pantone Yellow）
 *      + 星环下方的白色国别代码。
 *
 * 星环几何遵循 Council of Europe《Flag of Europe》规范：12 颗正五角星，
 * 等角度（30°）分布在圆环上，每颗星一个尖角朝上。
 */

import { glyphTransform } from '@/lib/plate/layout';
import { EU_COLORS, EU_COUNTRY_CODE, EU_STARS } from '@/lib/standards/eu';
import type { CharClass, ComponentDecoration, PlateType } from '@/types/standard';

/**
 * 生成一颗正五角星的路径（外接圆半径 R，中心 cx,cy，一个尖角朝正上）。
 * 五角星 = 5 个外顶点 + 5 个内顶点交替；内径 = R × sin(18°)/sin(126°) ≈ R×0.382。
 */
function starPath(cx: number, cy: number, R: number): string {
  const inner = R * 0.381966; // 正五角星内径/外径比
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const radius = i % 2 === 0 ? R : inner;
    // 尖角朝上：从 -90° 起，每步 36°
    const ang = (-90 + i * 36) * (Math.PI / 180);
    const x = cx + radius * Math.cos(ang);
    const y = cy + radius * Math.sin(ang);
    pts.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(3)} ${y.toFixed(3)}`);
  }
  return `${pts.join(' ')} Z`;
}

export interface EuBandProps {
  dec: ComponentDecoration;
  type: PlateType;
  values: Record<string, string>;
  idPrefix: string;
}

/**
 * 欧盟蓝带。
 *
 * 蓝带宽 45mm，占据牌体全高；左侧两圆角与牌体一致（R10），右侧为直角。
 * 用 path 绘制以获得「左圆右方」的形状。
 */
export function EuBand({ dec, type, values, idPrefix }: EuBandProps) {
  const props = (dec.props ?? {}) as {
    bandWidth?: number;
    height?: number;
    radius?: number;
    side?: 'left' | 'right';
    code?: string;
    showStars?: boolean;
  };
  const bandW = props.bandWidth ?? 45;
  const H = props.height ?? type.size.height;
  const R = props.radius ?? 10;
  const W = type.size.width;
  const right = props.side === 'right';
  const showStars = props.showStars ?? true;

  // 蓝带路径：靠左时左侧圆角、靠右时右侧圆角
  const bandPath = right
    ? `M${W - bandW} 0 L${W - R} 0 A${R} ${R} 0 0 1 ${W} ${R} L${W} ${H - R} A${R} ${R} 0 0 1 ${W - R} ${H} L${W - bandW} ${H} Z`
    : `M${R} 0 L${bandW} 0 L${bandW} ${H} L${R} ${H} A${R} ${R} 0 0 1 0 ${H - R} L0 ${R} A${R} ${R} 0 0 1 ${R} 0 Z`;

  const country = (props.code ?? values.country ?? 'D').toUpperCase();

  // 12 星环
  const stars = !showStars
    ? []
    : Array.from({ length: EU_STARS.count }, (_, i) => {
        const ang = (i * 360) / EU_STARS.count - 90; // 从正上开始
        const rad = (ang * Math.PI) / 180;
        const cx = EU_STARS.cx + EU_STARS.radius * Math.cos(rad);
        const cy = EU_STARS.cy + EU_STARS.radius * Math.sin(rad);
        return starPath(cx, cy, EU_STARS.starRadius);
      });

  // 国别代码：用统一 ink 拟合引擎，保证字高精确 = EU_COUNTRY_CODE.height。
  // 每个字符占一个 advance 宽度的单元格，整体居中于蓝带。
  // 国家代码只含单码点字符，按码点拆分即为逐字符处理
  // oxlint-disable-next-line typescript/no-misused-spread
  const codeChars = [...country];
  const codeClass: CharClass = {
    id: 'country',
    height: EU_COUNTRY_CODE.height,
    width: EU_COUNTRY_CODE.height * 0.62, // FE-Schrift 大写近似宽比
    advance: EU_COUNTRY_CODE.height * 0.62,
    fit: 'uniform',
    fill: { kind: 'solid', color: EU_COUNTRY_CODE.color },
    font: type.charClasses.letter.font,
  };
  const cellW = codeClass.advance ?? EU_COUNTRY_CODE.height * 0.62;
  const totalW = codeChars.length * cellW;
  const centerX = right ? W - bandW / 2 : EU_STARS.cx;
  const startX = centerX - totalW / 2;
  // 基线 baseline → 单元格顶边 = baseline - 字高
  const cellTop = EU_COUNTRY_CODE.baseline - EU_COUNTRY_CODE.height;

  return (
    <g>
      <path d={bandPath} fill={EU_COLORS.reflexBlue} />
      {/* 12 星 */}
      {stars.map((d, i) => (
        <path key={i} d={d} fill={EU_STARS.color} />
      ))}
      {/* 国别代码（ink 拟合） */}
      {codeChars.map((ch, i) => {
        const cell = { x: startX + i * cellW, y: cellTop, w: cellW, h: EU_COUNTRY_CODE.height };
        const { transform, fontSize } = glyphTransform(ch, codeClass, cell);
        return (
          <text
            key={i}
            transform={transform}
            fontSize={fontSize}
            fontFamily={`'${codeClass.font.family}', sans-serif`}
            fill={EU_COUNTRY_CODE.color}
            x={0}
            y={0}
            textAnchor="start"
            dominantBaseline="alphabetic"
            data-idprefix={idPrefix}
          >
            {ch}
          </text>
        );
      })}
    </g>
  );
}
