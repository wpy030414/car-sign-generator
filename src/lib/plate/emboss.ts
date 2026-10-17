/**
 * 号牌冲压（emboss）参数。
 *
 * 算法：把字符 alpha 当作**高度场** → 高斯模糊得到圆滑的高度分布 →
 * `feSpecularLighting` / `feDiffuseLighting` 用同一盏定向光按法线计算明暗。
 *
 * 为什么不用「偏移副本」：
 * - 偏移剪影只在下/右方向加了一层影子，轮廓法线方向变化时（圆弧、S 形）
 *   高光与暗面的错位量恒定，曲线看起来像贴纸而不是浮雕；
 * - 亮/暗是两份错位的剪影，在正上/正下/正左/正右的转折点处两份剪影都盖不满，
 *   会出现空缺（右上、左下尤其明显）；
 * - 高度场 + 光照是连续函数：明暗强度随轮廓法线平滑变化，任何曲线/拐角都不会断开。
 *
 * 滤镜定义见 `PlateSvg.tsx` 的 `EmbossFilter`，预览与 4K 导出共用同一份矢量滤镜，
 * 与分辨率无关（mm 坐标系）。
 */

export const EMBOSS = {
  /** 高度场模糊半径（mm）：决定倒角宽度与柔化程度 */
  blurSigmaMm: 0.5,
  /** 高度场缩放：越大法线越陡，明暗对比越强 */
  surfaceScale: 2.0,
  /** 高光强度（0–1） */
  specularConstant: 1,
  /** 高光聚拢程度：越大高光越窄越锐 */
  specularExponent: 22,
  /** 漫反射压暗强度（0–1）；平面处归一化为 1，不改变字符原色 */
  diffuseStrength: 0.45,
  /**
   * 投射阴影：浮雕字符会向背光侧（右下）在牌面上投下柔和的影子，
   * 这是「凸起」最强的视觉线索。offset 为 mm，与字高无关（冲压深度是牌面属性）。
   */
  castOffsetMm: 0.9,
  castBlurMm: 0.7,
  castOpacity: 0.45,
  /** 定向光方位角（度）：225° = 左上方，与真实冲压牌面一致 */
  lightAzimuth: 225,
  /** 定向光仰角（度） */
  lightElevation: 42,
  /** 滤镜区域外扩比例（相对包围盒），需容纳约 3σ 的羽化 */
  regionMargin: 0.35,
} as const;

/** 漫反射归一化系数：使平面（法线朝上）的输出恰好为 1。 */
export function diffuseTransfer(): { slope: number; intercept: number } {
  const flat = Math.sin((EMBOSS.lightElevation * Math.PI) / 180);
  return {
    slope: EMBOSS.diffuseStrength / flat,
    intercept: 1 - EMBOSS.diffuseStrength,
  };
}
