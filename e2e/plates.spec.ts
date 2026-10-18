import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

/**
 * 端到端测试：覆盖四国号牌的渲染、编辑、校验、导出全流程。
 *
 * 断言基于渲染后 SVG 的几何/内容与导出 PNG 的真实字节，
 * 而非快照图片，保证确定性与可读的失败信息。
 */

/** 读取 PNG IHDR 得到像素尺寸。 */
function pngSize(buf: Buffer): { w: number; h: number } {
  // PNG 签名 8 字节 + IHDR length(4) + 'IHDR'(4) → 宽高在 offset 16/20（大端）
  expect(buf.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

/** 抓号牌 SVG 的文本内容与 viewBox。 */
async function plateInfo(page: import('@playwright/test').Page) {
  // 字体就绪前预览显示加载占位，先等真实 SVG 挂载
  await page.locator('svg[data-plate-svg]').waitFor();
  return page.evaluate(() => {
    const svg = document.querySelector('svg[data-plate-svg]');
    if (!svg) return null;
    return {
      id: svg.getAttribute('data-plate-svg'),
      viewBox: svg.getAttribute('viewBox'),
      chars: [...svg.querySelectorAll('text, [data-char]')]
        .map((t) => t.getAttribute('data-char') ?? t.textContent)
        .join(''),
    };
  });
}

test.describe('首屏与默认状态', () => {
  test('默认渲染中国小型汽车号牌', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('svg[data-plate-svg]')).toHaveAttribute(
      'data-plate-svg',
      'cn-small-car',
    );
    const info = await plateInfo(page);
    expect(info?.viewBox).toBe('0 0 440 140'); // GA 36-2018 表2
    expect(info?.chars).toBe('京A00001');
  });

  test('标题与四国 Tabs 均存在', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: '机动车号牌生成器' })).toBeVisible();
    for (const name of ['中国', '欧盟', '美国', '日本']) {
      await expect(page.getByRole('tab', { name })).toBeVisible();
    }
  });

  test('顶部栏 GitHub 入口指向本项目仓库', async ({ page }) => {
    await page.goto('/');
    const link = page.getByRole('link', { name: '在 GitHub 上查看本项目' });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', 'https://github.com/wpy030414/car-sign-generator');
    await expect(link).toHaveAttribute('target', '_blank');
  });

  test('显示物理尺寸与合法徽章', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('440 × 140 mm')).toBeVisible();
    await expect(page.getByText('合法号牌')).toBeVisible();
  });
});

test.describe('国家切换', () => {
  test('切到欧盟渲染蓝带与 FE-Schrift 注册号', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('tab', { name: '欧盟' }).click();
    const info = await plateInfo(page);
    expect(info?.id).toBe('eu-de');
    expect(info?.viewBox).toBe('0 0 520 110');
    // 蓝带 12 星 + 国别代码
    const stars = await page.locator('svg[data-plate-svg] path[fill="#FFCC00"]').count();
    expect(stars).toBe(12);
    await expect(page.locator('svg[data-plate-svg]')).toContainText('D');
  });

  test('切到美国渲染 6×12in 牌面与安装孔', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('tab', { name: '美国' }).click();
    const info = await plateInfo(page);
    expect(info?.id).toBe('us-standard');
    expect(info?.viewBox).toBe('0 0 304.8 152.4');
    // 两个安装孔（7in 间距）
    const holes = await page.locator('svg[data-plate-svg] rect[stroke="#999999"]').count();
    expect(holes).toBe(2);
  });

  test('切到日本渲染四区布局', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('tab', { name: '日本' }).click();
    const info = await plateInfo(page);
    expect(info?.id).toBe('jp-private-mid');
    expect(info?.viewBox).toBe('0 0 330 165');
    expect(info?.chars).toBe('品川500さ12-34');
  });
});

test.describe('字段编辑与实时预览', () => {
  test('编辑序号实时反映到预览', async ({ page }) => {
    await page.goto('/?region=CN&type=cn-small-car');
    await page.locator('input#serial').fill('88888');
    const info = await plateInfo(page);
    expect(info?.chars).toBe('京A88888');
  });

  test('编辑省份实时反映', async ({ page }) => {
    await page.goto('/?region=CN&type=cn-small-car');
    await page.locator('input#province').fill('沪');
    const info = await plateInfo(page);
    expect(info?.chars).toBe('沪A00001');
  });

  test('非法字符被即时过滤', async ({ page }) => {
    await page.goto('/?region=CN&type=cn-small-car');
    // 注意：DOM input 有 maxLength=5，浏览器会先截断到 5 字符再触发 onChange。
    // 故填入 5 字符内含非法符号，验证 sanitizeInput 剔除非法字符。
    await page.locator('input#serial').fill('A*B1C'); // '*' 非法
    await expect(page.locator('input#serial')).toHaveValue('AB1C');
  });

  test('小写字母被过滤（仅允许大写）', async ({ page }) => {
    await page.goto('/?region=CN&type=cn-small-car');
    await page.locator('input#serial').fill('ab012'); // 小写 a b 非法
    await expect(page.locator('input#serial')).toHaveValue('012');
  });
});

test.describe('校验', () => {
  test('清空省份 → 徽章变为不合法', async ({ page }) => {
    await page.goto('/?region=CN&type=cn-small-car');
    await expect(page.getByText('合法号牌')).toBeVisible();
    await page.locator('input#province').fill('');
    await expect(page.getByText('合法号牌')).toHaveCount(0);
    await expect(page.getByText(/不符合/)).toBeVisible();
  });

  test('序号过短 → 不合法', async ({ page }) => {
    await page.goto('/?region=CN&type=cn-small-car');
    await page.locator('input#serial').fill('12');
    await expect(page.getByText(/不符合/)).toBeVisible();
  });

  test('恢复合法 → 徽章恢复', async ({ page }) => {
    await page.goto('/?region=CN&type=cn-small-car');
    await page.locator('input#serial').fill('12');
    await expect(page.getByText(/不符合/)).toBeVisible();
    await page.locator('input#serial').fill('00001');
    await expect(page.getByText('合法号牌')).toBeVisible();
  });
});

test.describe('预设合法性', () => {
  // 回归：整串校验曾把所有字段（含州名/口号、国别代码）拼进注册号，
  // 且漏掉中国号牌的固定尾字，导致大量预设被误判为「不符合格式」。
  const presets: [string, string][] = [
    ['/?region=CN&type=cn-trailer', '挂车（固定尾字「挂」）'],
    ['/?region=CN&type=cn-coach', '教练汽车（固定尾字「学」）'],
    ['/?region=CN&type=cn-police', '警用汽车（固定尾字「警」）'],
    ['/?region=CN&type=cn-embassy', '使馆汽车（固定尾字「使」）'],
    ['/?region=CN&type=cn-consulate', '领馆汽车（固定尾字「领」）'],
    ['/?region=CN&type=cn-consulate-moto', '领馆摩托车（两行 + 用途字）'],
    ['/?region=US&type=us-al', '阿拉巴马州（州名/口号不参与注册号）'],
    ['/?region=US&type=us-co', '科罗拉多州'],
    ['/?region=US&type=us-dc', '华盛顿特区（长口号）'],
    ['/?region=EU&type=eu-be', '比利时（含连字符）'],
    ['/?region=EU&type=eu-hr', '克罗地亚（10 位注册号）'],
    ['/?region=EU&type=eu-ie', '爱尔兰（11 位注册号）'],
    ['/?region=EU&type=eu-fr', '法国（右侧地区带不参与注册号）'],
  ];

  for (const [url, name] of presets) {
    test(`${name} 预设显示合法`, async ({ page }) => {
      await page.goto(url);
      await expect(page.getByText('合法号牌')).toBeVisible();
    });
  }
});

test.describe('类型切换', () => {
  test('中国切换到警用号牌（点在省份后 + 红警字）', async ({ page }) => {
    await page.goto('/?region=CN&type=cn-small-car');
    await page.locator('[role=combobox]').first().click();
    await page.getByRole('option', { name: '警用汽车号牌' }).click();
    const info = await plateInfo(page);
    expect(info?.id).toBe('cn-police');
    expect(info?.chars).toBe('京A0001警');
    // 分隔点在第 0 位（省份）之后：cx < 字母 x
    const dotCx = await page.evaluate(() =>
      document.querySelector('svg[data-plate-svg] circle')?.getAttribute('cx'),
    );
    expect(dotCx).not.toBeNull();
  });

  test('欧盟切换法国式', async ({ page }) => {
    await page.goto('/?region=EU&type=eu-de');
    await page.locator('[role=combobox]').first().click();
    await page.getByRole('option', { name: '法国', exact: true }).click();
    const info = await plateInfo(page);
    expect(info?.id).toBe('eu-fr');
  });
});

test.describe('URL 持久化', () => {
  test('链接以单个 base64 配置参数承载全部状态', async ({ page }) => {
    await page.goto('/?region=CN&type=cn-small-car');
    await page.getByLabel('序号').fill('12345');
    await page.locator('[role=switch]').first().click();
    await expect.poll(() => new URL(page.url()).searchParams.get('config')).toBeTruthy();

    // 解析 config：base64url → UTF-8 JSON
    const config = await page.evaluate(() => {
      const raw = new URL(location.href).searchParams.get('config')!;
      const b64 = raw.replace(/-/g, '+').replace(/_/g, '/');
      const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
      return JSON.parse(
        new TextDecoder().decode(Uint8Array.from(atob(padded), (c) => c.charCodeAt(0))),
      );
    });
    expect(config).toMatchObject({
      region: 'CN',
      typeId: 'cn-small-car',
      values: { serial: '12345' },
      showScrews: false,
      exportLongEdge: 3840,
    });
    // 不应再有分散的 region/type/values 参数
    expect([...new URL(page.url()).searchParams.keys()]).toEqual(['config']);

    // 重开同一链接，状态应完整还原
    await page.goto(page.url());
    await expect(page.getByLabel('序号')).toHaveValue('12345');
    await expect(page.locator('[role=switch]').first()).not.toBeChecked();
    expect((await plateInfo(page))?.id).toBe('cn-small-car');
  });

  test('带 query 的链接还原对应号牌', async ({ page }) => {
    const url =
      '/?region=JP&type=jp-commercial-mid&values=' +
      encodeURIComponent(
        JSON.stringify({ place: '横浜', classNum: '300', kana: 'あ', serial: '55-77' }),
      );
    await page.goto(url);
    const info = await plateInfo(page);
    expect(info?.id).toBe('jp-commercial-mid');
    expect(info?.chars).toBe('横浜300あ55-77');
  });

  test('非法 typeId 回退默认', async ({ page }) => {
    await page.goto('/?region=CN&type=does-not-exist');
    // 不应崩溃，仍渲染某个号牌
    await expect(page.locator('svg[data-plate-svg]')).toBeVisible();
  });
});

test.describe('新能源号牌背景', () => {
  test('小型牌自下而上为 50% 纯绿 + 33.33% 绿白渐变 + 16.67% 纯白', async ({ page }) => {
    await page.goto('/?region=CN&type=cn-ne-small');
    await page.locator('svg[data-plate-svg]').waitFor();
    const stops = await page.evaluate(() =>
      [...document.querySelectorAll('svg[data-plate-svg] linearGradient stop')].map((s) => ({
        offset: parseFloat(s.getAttribute('offset') ?? ''),
        color: (s.getAttribute('stop-color') ?? '').toUpperCase(),
      })),
    );
    expect(stops).toHaveLength(4);
    // stop 方向为上→下：0~1/6 白、1/6~1/2 白→绿、1/2~1 纯绿
    expect(stops.map((s) => s.color)).toEqual(['#FFFFFF', '#FFFFFF', '#25E148', '#25E148']);
    expect(stops[0].offset).toBeCloseTo(0, 3);
    expect(stops[1].offset).toBeCloseTo(16.667, 2);
    expect(stops[2].offset).toBeCloseTo(50, 3);
    expect(stops[3].offset).toBeCloseTo(100, 3);
  });

  test('字母/数字使用新能源专用字体（1 带衬线），普通号牌不受影响', async ({ page }) => {
    await page.goto('/?region=CN&type=cn-ne-small');
    await page.getByLabel('序号').fill('D10234');

    const glyphs = await page
      .locator('svg[data-plate-svg] text')
      .evaluateAll((els) =>
        els.map((el) => ({ ch: el.textContent, ff: el.getAttribute('font-family') ?? '' })),
      );
    expect(glyphs.map((g) => g.ch).join('')).toBe('京AD10234');
    // 省简称：仍是号牌汉字字体
    expect(glyphs[0].ff).toContain("'CN-Plate'");
    expect(glyphs[0].ff).not.toContain('CN-NE-Latin');
    // 代号 + 序号：全部走新能源专用字体
    for (const g of glyphs.slice(1)) expect(g.ff).toContain("'CN-NE-Latin'");
    // `1` 的衬线来自字体本身，不是渲染层补丁
    expect(glyphs.find((g) => g.ch === '1')?.ff).toContain("'CN-NE-Latin'");

    // 专用字体确实已加载
    const loaded = await page.evaluate(async () => {
      await document.fonts.ready;
      return document.fonts.check('100px "CN-NE-Latin"', '1');
    });
    expect(loaded).toBe(true);

    // 普通号牌保持原字体
    await page.goto('/?region=CN&type=cn-small-car');
    const normal = await page
      .locator('svg[data-plate-svg] text')
      .first()
      .getAttribute('font-family');
    expect(normal).toContain("'CN-Plate'");
    expect(normal).not.toContain('CN-NE-Latin');
  });

  test('大型新能源绿色矩形上下各留 8mm，不顶黑色边框', async ({ page }) => {
    await page.goto('/?region=CN&type=cn-ne-large');
    const panel = await page.locator('svg[data-plate-svg] rect[fill="#25E148"]').evaluate((r) => ({
      y: Number(r.getAttribute('y')),
      h: Number(r.getAttribute('height')),
    }));
    expect(panel.y).toBeCloseTo(8, 2);
    expect(panel.h).toBeCloseTo(124, 2);
    // 边框内缘 = inset 3 + 线宽 2 = 5mm，面板与边框之间仍留出 3mm
    expect(panel.y - 5).toBeGreaterThanOrEqual(3);
  });

  test('新能源专用标识直径 28mm（半径 14mm）', async ({ page }) => {
    await page.goto('/?region=CN&type=cn-ne-small');
    await page.locator('svg[data-plate-svg]').waitFor();
    const size = await page.evaluate(() => {
      const img = document.querySelector('svg[data-plate-svg] image')!;
      return { w: Number(img.getAttribute('width')), h: Number(img.getAttribute('height')) };
    });
    expect(size.w).toBeCloseTo(28, 1);
    expect(size.h).toBeCloseTo(28, 1);
  });
});

test.describe('导出设置', () => {
  test('安装孔尺寸符合标准：汽车长圆孔 15×7，摩托圆孔 φ7', async ({ page }) => {
    await page.goto('/?region=CN&type=cn-small-car');
    await page.locator('svg[data-plate-svg]').waitFor();
    const car = await page.evaluate(() => {
      const r = document.querySelector('svg[data-plate-svg] rect[stroke="#999999"]')!;
      return { w: Number(r.getAttribute('width')), h: Number(r.getAttribute('height')) };
    });
    expect(car.w).toBeCloseTo(15, 1);
    expect(car.h).toBeCloseTo(7, 1);

    await page.goto('/?region=CN&type=cn-moto');
    await page.locator('svg[data-plate-svg]').waitFor();
    const moto = await page.evaluate(() => {
      const r = document.querySelector('svg[data-plate-svg] rect[stroke="#999999"]')!;
      return { w: Number(r.getAttribute('width')), h: Number(r.getAttribute('height')) };
    });
    expect(moto.w).toBeCloseTo(7, 1);
    expect(moto.h).toBeCloseTo(7, 1);
  });

  test('安装孔开关生效', async ({ page }) => {
    await page.goto('/?region=CN&type=cn-small-car');
    await page.locator('svg[data-plate-svg]').waitFor();
    const before = await page.locator('svg[data-plate-svg] rect[stroke="#999999"]').count();
    expect(before).toBe(4);
    await page.locator('[role=switch]').first().click();
    const after = await page.locator('svg[data-plate-svg] rect[stroke="#999999"]').count();
    expect(after).toBe(0);
  });

  test('模拟冲压：字符以高度场 + 定向光生成浮雕，而非偏移副本', async ({ page }) => {
    await page.goto('/?region=CN&type=cn-small-car');
    const svg = page.locator('svg[data-plate-svg]');
    await svg.waitFor();
    const embossed = svg.locator('g[filter*="emboss"]');
    const glyphs = await svg.locator('text').count(); // 未开启时 text 数 = 字符数
    expect(glyphs).toBeGreaterThan(0);

    // 默认关闭：没有滤镜组，也没有重复字符
    expect(await embossed.count()).toBe(0);
    expect(await svg.locator('filter').count()).toBe(0);

    await page.locator('#emboss').click();

    // 整层字符共用一个滤镜组（滤镜挂在 <g> 上，不在带 scale 的 <text> 上），
    // 外加分隔点与 GA 36 的冲压边框
    expect(await embossed.count()).toBe(3);
    expect(await svg.locator('filter').count()).toBe(1);
    expect(await svg.locator('g[filter*="emboss"] > g').count()).toBeGreaterThan(0);
    // 边框（整板冲压）进入浮雕：边框 rect 位于滤镜组内
    expect(await svg.locator('g[filter*="emboss"] rect[data-plate-border]').count()).toBe(1);
    // 不再有偏移出来的亮/暗副本：text 数量不变
    expect(await svg.locator('text').count()).toBe(glyphs);
    expect(await svg.locator('text[fill-opacity]').count()).toBe(0);
    // 分隔点同样走浮雕滤镜
    expect(await svg.locator('g[filter*="emboss"] circle').count()).toBe(1);

    // 滤镜管线：高度场 → 高光/漫反射 → 投射阴影
    const pipeline = await svg
      .locator('filter')
      .first()
      .evaluate((f) => ({
        sRGB: f.getAttribute('color-interpolation-filters'),
        prims: [...f.children].map((c) => c.tagName),
        azimuth: f.querySelector('feDistantLight')?.getAttribute('azimuth'),
        elevation: f.querySelector('feDistantLight')?.getAttribute('elevation'),
      }));
    expect(pipeline.sRGB).toBe('sRGB');
    for (const prim of [
      'feGaussianBlur',
      'feSpecularLighting',
      'feDiffuseLighting',
      'feComponentTransfer',
      'feOffset',
      'feFlood',
    ]) {
      expect(pipeline.prims).toContain(prim);
    }
    // 光从左上来（SVG y 轴向下，225°），阴影落向右下
    expect(pipeline.azimuth).toBe('225');
    expect(Number(pipeline.elevation)).toBeGreaterThan(0);
  });

  test('GA 36 边框：线外缘距牌边 3mm，外侧留一圈底色', async ({ page }) => {
    await page.goto('/?region=CN&type=cn-small-car');
    const rect = await page
      .locator('svg[data-plate-svg] rect[data-plate-border]')
      .evaluate((r) => ({
        x: Number(r.getAttribute('x')),
        y: Number(r.getAttribute('y')),
        w: Number(r.getAttribute('width')),
        h: Number(r.getAttribute('height')),
        stroke: Number(r.getAttribute('stroke-width')),
        rx: Number(r.getAttribute('rx')),
      }));
    // 牌边 → 3mm 底色 → 2mm 白边：rect 中心线内缩 3 + 1，宽高减去两侧 4
    expect(rect.x).toBeCloseTo(4, 2);
    expect(rect.y).toBeCloseTo(4, 2);
    expect(rect.w).toBeCloseTo(440 - 8, 2);
    expect(rect.h).toBeCloseTo(140 - 8, 2);
    expect(rect.stroke).toBe(2);
    // 圆角同样内缩：R10 - 4
    expect(rect.rx).toBeCloseTo(6, 2);
  });

  test('印刷边框不参与浮雕（仅整板冲压的 GA 36 边框冲压）', async ({ page }) => {
    await page.goto('/?region=US&type=us-standard');
    const svg = page.locator('svg[data-plate-svg]');
    await page.locator('#emboss').click();
    // 边框存在，但不在滤镜组内
    expect(await svg.locator('rect[data-plate-border]').count()).toBe(1);
    expect(await svg.locator('g[filter*="emboss"] rect[data-plate-border]').count()).toBe(0);
  });

  test('分辨率可选 2K/4K/8K', async ({ page }) => {
    await page.goto('/?region=CN&type=cn-small-car');
    await page.locator('[role=combobox]').nth(1).click();
    await expect(page.getByRole('option', { name: /2K/ })).toBeVisible();
    await expect(page.getByRole('option', { name: /4K/ })).toBeVisible();
    await expect(page.getByRole('option', { name: /8K/ })).toBeVisible();
  });
});

test.describe('4K PNG 导出', () => {
  test('中国号牌导出 3840px 长边 PNG', async ({ page }) => {
    await page.goto('/?region=CN&type=cn-small-car');
    await page.evaluate(() => document.fonts.ready);
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: /下载 PNG/ }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/cn-small-car.*3840px\.png/);
    const path = await download.path();
    const buf = readFileSync(path!);
    const { w, h } = pngSize(buf);
    expect(w).toBe(3840);
    // 440:140 → h = round(3840 * 140/440) = 1222
    expect(h).toBe(1222);
  });

  test('新能源号牌导出（专用字体 base64 内联）比例正确', async ({ page }) => {
    await page.goto('/?region=CN&type=cn-ne-small');
    await page.getByLabel('序号').fill('D10234');
    await page.evaluate(() => document.fonts.ready);
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: /下载 PNG/ }).click(),
    ]);
    const buf = readFileSync((await download.path())!);
    const { w, h } = pngSize(buf);
    expect(w).toBe(3840);
    expect(h).toBe(1120); // round(3840 * 140/480)
  });

  test('欧盟号牌导出比例正确（520×110）', async ({ page }) => {
    await page.goto('/?region=EU&type=eu-de');
    await page.evaluate(() => document.fonts.ready);
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: /下载 PNG/ }).click(),
    ]);
    const buf = readFileSync((await download.path())!);
    const { w, h } = pngSize(buf);
    expect(w).toBe(3840);
    expect(h).toBe(812); // round(3840*110/520)
  });

  test('导出 PNG 含真实字形像素（非空白/非全色块）', async ({ page }) => {
    await page.goto('/?region=CN&type=cn-small-car');
    await page.evaluate(() => document.fonts.ready);
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: /下载 PNG/ }).click(),
    ]);
    const buf = readFileSync((await download.path())!);
    // 文件应远大于纯色 PNG（含字形细节 → 压缩后仍有可观体积）
    expect(buf.length).toBeGreaterThan(50_000);
  });
});

test.describe('GA 36-2018 版式实测回归', () => {
  /** 取每个字符的 transform 平移 y，用于判断是否分两行。 */
  async function rows(page: import('@playwright/test').Page) {
    return page.evaluate(() =>
      [...document.querySelectorAll('svg[data-plate-svg] text, svg[data-plate-svg] [data-y]')].map(
        (t) => {
          const y = t.getAttribute('data-y');
          if (y !== null) return Number(y);
          const m = /translate\(([-\d.]+) ([-\d.]+)\)/.exec(t.getAttribute('transform') ?? '');
          return m ? Number(m[2]) : NaN;
        },
      ),
    );
  }

  test('普通摩托车号牌为 220×140 两行版式（图9）', async ({ page }) => {
    await page.goto('/?region=CN&type=cn-moto');
    const info = await plateInfo(page);
    expect(info?.viewBox).toBe('0 0 220 140');
    const ys = await rows(page);
    // 两行版式：字位纵向跨度远大于单行字形高度（50mm）
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(30);
  });

  test('轻便摩托车号为 220×140 蓝底白字（表1）', async ({ page }) => {
    await page.goto('/?region=CN&type=cn-moped');
    const info = await plateInfo(page);
    expect(info?.viewBox).toBe('0 0 220 140');
  });

  test('小型新能源汽车号牌为 480×140（图7）', async ({ page }) => {
    await page.goto('/?region=CN&type=cn-ne-small');
    const info = await plateInfo(page);
    expect(info?.viewBox).toBe('0 0 480 140');
  });

  test('大型汽车后号牌为 440×220 两行（图6）', async ({ page }) => {
    await page.goto('/?region=CN&type=cn-large-car-rear');
    const info = await plateInfo(page);
    expect(info?.viewBox).toBe('0 0 440 220');
    const ys = await rows(page);
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(40);
  });
});

test.describe('预览区缩放与全屏', () => {
  // 缩放值写在舞台的 CSS 变量上，画布宽度由它参与 calc 计算
  const zoomLevel = (page: import('@playwright/test').Page) =>
    page
      .locator('[data-plate-stage]')
      .evaluate((el) => (el as HTMLElement).style.getPropertyValue('--plate-zoom').trim());

  test('左下角 +/- 调节缩放，点击百分比重置', async ({ page }) => {
    await page.goto('/');
    await expect(zoomLevel(page)).resolves.toBe('1');

    await page.getByRole('button', { name: '放大' }).click();
    await expect(zoomLevel(page)).resolves.toBe('1.25');
    await expect(page.getByRole('button', { name: '重置缩放为 100%' })).toHaveText('125%');

    await page.getByRole('button', { name: '缩小' }).click();
    await page.getByRole('button', { name: '缩小' }).click();
    await expect(zoomLevel(page)).resolves.toBe('0.75');

    await page.getByRole('button', { name: '重置缩放为 100%' }).click();
    await expect(zoomLevel(page)).resolves.toBe('1');
  });

  test('100% 时左右留白相等，放大滚到尽头仍保留右侧留白', async ({ page }) => {
    await page.goto('/');
    const margins = () =>
      page.evaluate(() => {
        const vp = document.querySelector('[data-plate-viewport]') as HTMLElement;
        const plate = document.querySelector('[data-plate-zoom]') as HTMLElement;
        const a = vp.getBoundingClientRect();
        const b = plate.getBoundingClientRect();
        return {
          left: Math.round(b.left - a.left),
          right: Math.round(a.right - b.right),
          overflowX: vp.scrollWidth - vp.clientWidth,
        };
      });

    expect(await margins()).toMatchObject({ left: 40, right: 40, overflowX: 0 });

    await page.getByRole('button', { name: '放大' }).click();
    // 放大后画布居中：溢出量左右大致对称
    const zoomed = await margins();
    expect(zoomed.overflowX).toBeGreaterThan(0);
    expect(Math.abs(zoomed.left - zoomed.right)).toBeLessThanOrEqual(2);

    // 滚到最右端，右侧留白不得为 0
    const end = await page.evaluate(() => {
      const vp = document.querySelector('[data-plate-viewport]') as HTMLElement;
      vp.scrollLeft = vp.scrollWidth;
      const plate = document.querySelector('[data-plate-zoom]') as HTMLElement;
      const a = vp.getBoundingClientRect();
      const b = plate.getBoundingClientRect();
      return Math.round(a.right - b.right);
    });
    expect(end).toBeGreaterThanOrEqual(39);
    expect(end).toBeLessThanOrEqual(42);
  });

  test('缩放范围夹在 25%–300%，边界按钮禁用', async ({ page }) => {
    await page.goto('/');
    const zoomIn = page.getByRole('button', { name: '放大' });
    const zoomOut = page.getByRole('button', { name: '缩小' });

    // 100% → 300% 需 8 次；到顶后按钮禁用且不再增大
    for (let i = 0; i < 8; i++) await zoomIn.click();
    await expect(zoomLevel(page)).resolves.toBe('3');
    await expect(zoomIn).toBeDisabled();

    for (let i = 0; i < 11; i++) await zoomOut.click();
    await expect(zoomLevel(page)).resolves.toBe('0.25');
    await expect(zoomOut).toBeDisabled();
  });

  test('右下角进入/退出全屏，Esc 也可退出', async ({ page }) => {
    await page.goto('/');
    const stage = page.locator('[data-plate-stage]');
    const toggle = page.getByRole('button', { name: '全屏预览' });

    await expect(stage).not.toHaveAttribute('data-fullscreen', 'true');
    await toggle.click();
    await expect(stage).toHaveAttribute('data-fullscreen', 'true');
    // 全屏时号牌仍在视野内，按钮切换为退出态
    await expect(page.locator('svg[data-plate-svg]')).toBeVisible();
    await expect(page.getByRole('button', { name: '退出全屏' })).toBeVisible();

    await page.getByRole('button', { name: '退出全屏' }).click();
    await expect(stage).not.toHaveAttribute('data-fullscreen', 'true');

    await page.getByRole('button', { name: '全屏预览' }).click();
    await expect(stage).toHaveAttribute('data-fullscreen', 'true');
    await page.keyboard.press('Escape');
    await expect(stage).not.toHaveAttribute('data-fullscreen', 'true');
  });
});

test.describe('字体加载', () => {
  test('字体加载期间显示进度条而不是空白号牌，加载完成后可导出', async ({ page }) => {
    // 人为放慢字体请求，确保能观察到加载态（本地字体通常瞬间完成）
    await page.route('**/fonts/**', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 700));
      await route.continue();
    });

    await page.goto('/?region=JP&type=jp-private-mid');

    const loading = page.locator('[data-font-loading]');
    await expect(loading).toBeVisible();
    await expect(loading.getByRole('progressbar')).toBeVisible();
    await expect(page.getByRole('button', { name: /字体加载中/ })).toBeDisabled();
    // 字体未就绪时不应有空白/回退字形的号牌 SVG
    await expect(page.locator('svg[data-plate-svg]')).toHaveCount(0);

    // 字体到达后换成真实号牌，导出按钮恢复
    await expect(page.locator('svg[data-plate-svg]')).toBeVisible({ timeout: 15000 });
    await expect(loading).toHaveCount(0);
    await expect(page.getByRole('button', { name: '下载 PNG' })).toBeEnabled();
  });

  test('切换国家时先显示进度条，新字体就绪后才替换号牌', async ({ page }) => {
    await page.route('**/fonts/JP-Plate.woff2', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 700));
      await route.continue();
    });

    await page.goto('/');
    // 默认中国号牌字体先加载完成
    await expect(page.locator('svg[data-plate-svg]')).toHaveAttribute(
      'data-plate-svg',
      'cn-small-car',
    );

    await page.getByRole('tab', { name: '日本' }).click();
    // 切换后的当帧就进入加载态，不渲染新类型的空白号牌
    await expect(page.locator('[data-font-loading]')).toBeVisible();
    await expect(page.locator('svg[data-plate-svg]')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /字体加载中/ })).toBeDisabled();

    await expect(page.locator('svg[data-plate-svg]')).toHaveAttribute(
      'data-plate-svg',
      'jp-private-mid',
      { timeout: 15000 },
    );
    await expect(page.locator('[data-font-loading]')).toHaveCount(0);
  });
});
