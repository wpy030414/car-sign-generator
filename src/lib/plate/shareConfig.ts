/**
 * 链接配置编解码：把编辑器状态打包成 JSON，再做 base64url 编码放进 URL query。
 *
 * 为什么用单参数承载整份 JSON：字段一多，逐个 query 参数既啰嗦又易被截断/转义错；
 * 单参数 + base64url 让链接是「一份自包含配置」，增删字段不需要改 URL 协议。
 *
 * base64url（`+`/`/` 换 `-`/`_`、去掉 `=`）可安全直接放进 query，无需再 encodeURIComponent。
 */

import { EXPORT_SIZES } from '@/lib/plate/export';
import { STANDARD_BY_REGION, TYPE_REGISTRY, TYPE_TO_REGION } from '@/lib/standards';
import type { Region } from '@/types/standard';

/** 页面可分享的完整配置。 */
export interface PlateConfig {
  region: Region;
  typeId: string;
  values: Record<string, string>;
  /** 是否显示安装孔 */
  showScrews: boolean;
  /** 是否模拟冲压（字符亮/暗阴影） */
  emboss: boolean;
  /** 导出长边像素 */
  exportLongEdge: number;
}

const VALID_LONG_EDGES: readonly number[] = Object.values(EXPORT_SIZES);

function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(raw: string): Uint8Array {
  const b64 = raw.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  const bin = atob(padded);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

/** 配置 → base64url 字符串（URL 安全）。 */
export function encodePlateConfig(config: PlateConfig): string {
  const json = JSON.stringify(config);
  return toBase64Url(new TextEncoder().encode(json));
}

/**
 * base64url 字符串 → 配置。非法输入（非 base64、非 JSON、字段类型不符）返回 null，
 * 调用方应回退到默认状态，绝不因一条坏链接让页面崩溃。
 */
export function decodePlateConfig(raw: string): Partial<PlateConfig> | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(fromBase64Url(raw)));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;

  const obj = parsed as Record<string, unknown>;
  const out: Partial<PlateConfig> = {};

  if (typeof obj.typeId === 'string' && obj.typeId in TYPE_REGISTRY) {
    out.typeId = obj.typeId;
    // 类型决定国家，避免两者冲突时渲染出不一致的状态
    out.region = TYPE_TO_REGION[obj.typeId];
  } else if (typeof obj.region === 'string' && obj.region in STANDARD_BY_REGION) {
    out.region = obj.region as Region;
  }

  if (obj.values && typeof obj.values === 'object' && !Array.isArray(obj.values)) {
    const values: Record<string, string> = {};
    for (const [k, v] of Object.entries(obj.values as Record<string, unknown>)) {
      if (typeof v === 'string') values[k] = v;
    }
    out.values = values;
  }

  if (typeof obj.showScrews === 'boolean') out.showScrews = obj.showScrews;

  if (typeof obj.emboss === 'boolean') out.emboss = obj.emboss;

  if (typeof obj.exportLongEdge === 'number' && VALID_LONG_EDGES.includes(obj.exportLongEdge)) {
    out.exportLongEdge = obj.exportLongEdge;
  }

  return out;
}
