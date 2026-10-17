/**
 * 号牌字段校验。
 *
 * 两层校验：
 * 1. **字段级**：字符集（charset）、长度（min/maxLength）。
 * 2. **整串级**：PlateType.pattern（完整号牌串正则），对应旧实现的「非法的牌号」提示。
 *
 * 返回结构化错误，供编辑器逐字段高亮。
 */

import type { FieldSpec, PlateType } from '@/types/standard';

export interface FieldError {
  key: string;
  message: string;
}

export interface ValidationResult {
  ok: boolean;
  /** 逐字段错误 */
  fieldErrors: FieldError[];
  /** 整串级错误（pattern 不匹配） */
  patternError?: string;
}

/** 校验单个字段。 */
export function validateField(spec: FieldSpec, value: string): string | null {
  const v = value ?? '';
  const min = spec.minLength ?? 0;
  if (v.length < min) {
    return min > 0 ? `至少 ${min} 位` : '不能为空';
  }
  if (v.length > spec.maxLength) {
    return `至多 ${spec.maxLength} 位`;
  }
  // charset 为空字符串表示不限制（如日本地名汉字）
  if (spec.charset && spec.charset.length > 0) {
    const allowed = new Set(spec.charset);
    for (const ch of v) {
      if (!allowed.has(ch)) {
        return `含非法字符「${ch}」`;
      }
    }
  }
  return null;
}

/**
 * 组装注册号主串（用于 pattern 校验与展示）。
 *
 * 只拼接标记了 `primary` 的布局序列：装饰性文字（美国州名/口号、欧盟右侧
 * 地区带等）不参与，固定字面量槽位（中国号牌尾字「挂/学/警/使/领/港/澳」）
 * 则按布局顺序进入主串。未标记任何 primary 时回退到全部序列。
 */
export function buildPlateString(type: PlateType, values: Record<string, string>): string {
  const primary = type.runs.filter((r) => r.primary);
  const runs = primary.length > 0 ? primary : type.runs;
  const parts: string[] = [];
  for (const run of runs) {
    if (run.kind === 'free') {
      const v = values[run.field] ?? '';
      if (v) parts.push(v);
      continue;
    }
    for (const slot of run.slots) {
      if (slot.literal !== undefined) {
        parts.push(slot.literal);
        continue;
      }
      if (!slot.field) continue;
      // 按码点取字符（汉字/假名均为单码点，与布局的 charIndex 语义一致）
      const ch = Array.from(values[slot.field] ?? '')[slot.charIndex ?? 0];
      if (ch !== undefined) parts.push(ch);
    }
  }
  return parts.join('');
}

/** 校验整个号牌。 */
export function validatePlate(
  type: PlateType,
  values: Record<string, string>,
): ValidationResult {
  const fieldErrors: FieldError[] = [];
  for (const spec of type.fields) {
    const err = validateField(spec, values[spec.key] ?? '');
    if (err) fieldErrors.push({ key: spec.key, message: err });
  }

  let patternError: string | undefined;
  if (type.pattern && fieldErrors.length === 0) {
    const full = buildPlateString(type, values);
    if (full && !type.pattern.test(full)) {
      patternError = `「${full}」不符合${type.label}格式`;
    }
  }

  return { ok: fieldErrors.length === 0 && !patternError, fieldErrors, patternError };
}

/** 按 charset 过滤输入（用于输入框 onChange 即时约束）。 */
export function sanitizeInput(spec: FieldSpec, raw: string): string {
  let v = raw;
  if (spec.charset && spec.charset.length > 0) {
    const allowed = new Set(spec.charset);
    v = [...v].filter((ch) => allowed.has(ch)).join('');
  }
  return v.slice(0, spec.maxLength);
}
