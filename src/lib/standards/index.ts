/**
 * 号牌标准注册表：所有国家/地区标准的统一入口。
 *
 * 新增一个国家 = 在此注册；新增一种版式 = 在对应国家文件里加一条 PlateType 数据。
 */

import { cnStandard } from './cn';
import { euStandard } from './eu';
import { jpStandard } from './jp';
import { usStandard } from './us';
import type { PlateType, Region, Standard } from '@/types/standard';

export const STANDARDS: Standard[] = [cnStandard, euStandard, usStandard, jpStandard];

/** region → Standard */
export const STANDARD_BY_REGION: Record<Region, Standard> = {
  CN: cnStandard,
  EU: euStandard,
  US: usStandard,
  JP: jpStandard,
};

/** typeId → PlateType（全局唯一） */
export const TYPE_REGISTRY: Record<string, PlateType> = Object.fromEntries(
  STANDARDS.flatMap((s) => s.types.map((t) => [t.id, t])),
);

/** typeId → 所属 region */
export const TYPE_TO_REGION: Record<string, Region> = Object.fromEntries(
  STANDARDS.flatMap((s) => s.types.map((t) => [t.id, s.region])),
);

/** 每个 region 的默认（首个）类型 */
export const DEFAULT_TYPE: Record<Region, string> = {
  CN: cnStandard.types[0].id,
  EU: euStandard.types[0].id,
  US: usStandard.types[0].id,
  JP: jpStandard.types[0].id,
};

export function getPlateType(typeId: string): PlateType {
  const t = TYPE_REGISTRY[typeId];
  if (!t) throw new Error(`未知号牌类型: ${typeId}`);
  return t;
}

/** 收集一个 PlateType 用到的所有字体（导出内联用）。 */
export function fontsOfType(type: PlateType) {
  const seen = new Map<string, (typeof type.charClasses)[string]['font']>();
  for (const cls of Object.values(type.charClasses)) seen.set(cls.font.family, cls.font);
  return [...seen.values()];
}
