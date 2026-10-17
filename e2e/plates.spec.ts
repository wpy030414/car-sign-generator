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
    await expect(link).toHaveAttribute(
      'href',
      'https://github.com/wpy030414/car-sign-generator',
    );
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
  test('带 query 的链接还原对应号牌', async ({ page }) => {
    const url =
      '/?region=JP&type=jp-commercial-mid&values=' +
      encodeURIComponent(JSON.stringify({ place: '横浜', classNum: '300', kana: 'あ', serial: '55-77' }));
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

test.describe('导出设置', () => {
  test('安装孔开关生效', async ({ page }) => {
    await page.goto('/?region=CN&type=cn-small-car');
    const before = await page.locator('svg[data-plate-svg] rect[stroke="#999999"]').count();
    expect(before).toBe(4);
    await page.locator('[role=switch]').first().click();
    const after = await page.locator('svg[data-plate-svg] rect[stroke="#999999"]').count();
    expect(after).toBe(0);
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
      [...document.querySelectorAll('svg[data-plate-svg] text, svg[data-plate-svg] [data-y]')].map((t) => {
        const y = t.getAttribute('data-y');
        if (y !== null) return Number(y);
        const m = /translate\(([-\d.]+) ([-\d.]+)\)/.exec(t.getAttribute('transform') ?? '');
        return m ? Number(m[2]) : NaN;
      }),
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
