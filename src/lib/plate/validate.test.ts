/**
 * 号牌校验单元测试。
 */

import { describe, expect, it } from 'vitest';
import { buildPlateString, sanitizeInput, validateField, validatePlate } from '@/lib/plate/validate';
import { getPlateType } from '@/lib/standards';

const smallCar = getPlateType('cn-small-car');

describe('validateField', () => {
  const serial = smallCar.fields.find((f) => f.key === 'serial')!;

  it('合法值通过', () => {
    expect(validateField(serial, '00001')).toBeNull();
  });

  it('超长报错', () => {
    expect(validateField(serial, '0000001')).toMatch(/至多/);
  });

  it('非法字符报错', () => {
    expect(validateField(serial, '0000*')).toMatch(/非法字符/);
  });

  it('空 charset（日本地名）不限制字符', () => {
    const jp = getPlateType('jp-private-mid');
    const place = jp.fields.find((f) => f.key === 'place')!;
    expect(validateField(place, '品川')).toBeNull();
  });
});

describe('sanitizeInput', () => {
  it('过滤非法字符并截断到 maxLength', () => {
    const serial = smallCar.fields.find((f) => f.key === 'serial')!;
    expect(sanitizeInput(serial, '0a*0001XX')).toBe('00001');
  });

  it('空 charset 不限制字符', () => {
    const jp = getPlateType('jp-private-mid');
    const place = jp.fields.find((f) => f.key === 'place')!;
    expect(sanitizeInput(place, '品川')).toBe('品川');
  });
});

describe('buildPlateString', () => {
  it('按字段顺序拼接', () => {
    expect(buildPlateString(smallCar, { province: '京', letter: 'A', serial: '00001' })).toBe('京A00001');
  });
});

describe('validatePlate', () => {
  it('合法小型汽车号牌通过', () => {
    const r = validatePlate(smallCar, { province: '京', letter: 'A', serial: '00001' });
    expect(r.ok).toBe(true);
  });

  it('省份为空 → pattern 失败', () => {
    const r = validatePlate(smallCar, { province: '', letter: 'A', serial: '00001' });
    expect(r.ok).toBe(false);
    expect(r.patternError).toMatch(/不符合/);
  });

  it('序号过短 → pattern 失败', () => {
    const r = validatePlate(smallCar, { province: '京', letter: 'A', serial: '12' });
    expect(r.ok).toBe(false);
  });

  it('字段级错误优先于 pattern 检查', () => {
    const r = validatePlate(smallCar, { province: '京', letter: 'A', serial: '0000000000' });
    expect(r.ok).toBe(false);
    expect(r.fieldErrors.length).toBeGreaterThan(0);
    expect(r.patternError).toBeUndefined(); // 字段错时不查 pattern
  });
});
