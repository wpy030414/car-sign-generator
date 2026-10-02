/**
 * SVG 填充渲染辅助：把 Fill（纯色/渐变）转为 SVG paint 引用。
 *
 * 渐变需要 <defs> 里的 <linearGradient>，ID 必须全页唯一（多个号牌同屏时），
 * 由调用方传入 idPrefix（通常来自 React useId）。
 */

import type { Fill } from '@/types/standard';

export interface FillResult {
  /** 用于 fill="" 的值 */
  paint: string;
  /** 需要放进 <defs> 的元素（渐变才有） */
  defs?: { id: string; angle: number; stops: { at: number; color: string }[] };
}

/**
 * 解析 Fill 为 paint 引用。
 * @param fill   填充定义
 * @param idPrefix 唯一前缀（渐变 ID 用）
 */
export function resolveFill(fill: Fill, idPrefix: string): FillResult {
  if (fill.kind === 'solid') return { paint: fill.color };
  const id = `grad-${idPrefix}`;
  return { paint: `url(#${id})`, defs: { id, angle: fill.angle, stops: fill.stops } };
}

/**
 * 渐变角度 → SVG linearGradient 的 x1/y1/x2/y2。
 * CSS 角度：0deg = 向上，90deg = 向右，180deg = 向下。
 * SVG：x1,y1 → x2,y2 为渐变方向向量。
 */
export function gradientVector(angleDeg: number): { x1: string; y1: string; x2: string; y2: string } {
  // 转为数学角（0 = 向右，逆时针），CSS 0deg 指向"上"即数学 90deg
  const rad = ((90 - angleDeg) * Math.PI) / 180;
  const dx = Math.cos(rad);
  const dy = -Math.sin(rad); // SVG y 向下
  // 以中心为单位向量两端
  const x1 = 0.5 - dx / 2;
  const y1 = 0.5 - dy / 2;
  const x2 = 0.5 + dx / 2;
  const y2 = 0.5 + dy / 2;
  const f = (n: number) => (Math.round(n * 10000) / 10000).toString();
  return { x1: f(x1), y1: f(y1), x2: f(x2), y2: f(y2) };
}
