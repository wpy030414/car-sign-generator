/**
 * 链接配置编解码单元测试：roundtrip、URL 安全性、坏输入回退。
 */

import { describe, expect, it } from 'vitest';
import { decodePlateConfig, encodePlateConfig, type PlateConfig } from '@/lib/plate/shareConfig';

const config: PlateConfig = {
  region: 'JP',
  typeId: 'jp-commercial-mid',
  values: { place: '横浜', classNum: '300', kana: 'あ', serial: '55-77' },
  showScrews: false,
  emboss: true,
  exportLongEdge: 7680,
};

describe('encodePlateConfig', () => {
  it('输出仅含 base64url 字符（可直接放进 query）', () => {
    const encoded = encodePlateConfig(config);
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(encoded).not.toContain('=');
  });
});

describe('decodePlateConfig', () => {
  it('roundtrip 保留全部字段（含 CJK）', () => {
    expect(decodePlateConfig(encodePlateConfig(config))).toEqual(config);
  });

  it('非法 base64 / 非法 JSON / 非对象返回 null', () => {
    expect(decodePlateConfig('%%%')).toBeNull();
    expect(decodePlateConfig(btoa('not json'))).toBeNull();
    expect(decodePlateConfig(btoa('[1,2,3]'))).toBeNull();
    expect(decodePlateConfig('')).toBeNull();
  });

  it('未知 typeId 被忽略，region 仍可还原', () => {
    const raw = btoa(JSON.stringify({ region: 'CN', typeId: 'nope', values: { a: 1 } }));
    expect(decodePlateConfig(raw)).toEqual({ region: 'CN', values: {} });
  });

  it('typeId 有效时以其所属国家为准', () => {
    const raw = btoa(JSON.stringify({ region: 'CN', typeId: 'us-al' }));
    expect(decodePlateConfig(raw)).toEqual({ region: 'US', typeId: 'us-al' });
  });

  it('缺少 emboss 时保持未定义（调用方回退默认关闭）', () => {
    expect(decodePlateConfig(btoa(JSON.stringify({ showScrews: true })))).toEqual({
      showScrews: true,
    });
  });

  it('非法分辨率被忽略，合法分辨率保留', () => {
    expect(decodePlateConfig(btoa(JSON.stringify({ exportLongEdge: 1234 })))).toEqual({});
    expect(decodePlateConfig(btoa(JSON.stringify({ exportLongEdge: 2560 })))).toEqual({
      exportLongEdge: 2560,
    });
  });
});
