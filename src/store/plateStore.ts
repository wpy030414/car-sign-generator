/**
 * 号牌编辑状态（Zustand + URL query 持久化）。
 *
 * 选择 Zustand 而非 Context：号牌随每次击键重渲染，Context 会让所有消费者一起重渲染，
 * 而 Zustand 的按键选择器让编辑面板与号牌预览独立更新。
 *
 * URL 持久化：整份配置（region/typeId/字段值/安装孔/导出分辨率）序列化为 JSON，
 * 再 base64url 编码放进单个 query 参数，任何号牌都是可分享链接。
 */

import { create } from 'zustand';
import { decodePlateConfig, encodePlateConfig } from '@/lib/plate/shareConfig';
import { DEFAULT_TYPE, getPlateType, STANDARD_BY_REGION, TYPE_REGISTRY, TYPE_TO_REGION } from '@/lib/standards';
import type { Region } from '@/types/standard';

export interface PlateState {
  region: Region;
  typeId: string;
  values: Record<string, string>;
  /** 导出长边像素 */
  exportLongEdge: number;
  /** 是否显示安装孔 */
  showScrews: boolean;
  /** 是否模拟冲压（字符亮/暗阴影） */
  emboss: boolean;
}

interface PlateActions {
  setRegion: (region: Region) => void;
  setType: (typeId: string) => void;
  setField: (key: string, value: string) => void;
  setExportLongEdge: (px: number) => void;
  setShowScrews: (v: boolean) => void;
  setEmboss: (v: boolean) => void;
  reset: () => void;
  /** 用示例值填充当前类型 */
  applySample: () => void;
}

/** 新链接使用的 query 参数名：`?config=<base64url(JSON)>`。 */
const CONFIG_PARAM = 'config';

/** 从 URL query 读取初始状态：优先新格式，其次兼容旧版分散参数。 */
function readUrl(): Partial<PlateState> {
  if (typeof window === 'undefined') return {};
  const p = new URLSearchParams(window.location.search);

  const encoded = p.get(CONFIG_PARAM);
  if (encoded) {
    const decoded = decodePlateConfig(encoded);
    if (decoded) return decoded;
  }

  // 旧链接兼容：region/type/values 分开传
  const out: Partial<PlateState> = {};
  const region = p.get('region') as Region | null;
  if (region && region in STANDARD_BY_REGION) out.region = region;
  const typeId = p.get('type');
  if (typeId && typeId in TYPE_REGISTRY) out.typeId = typeId;
  const values = p.get('values');
  if (values) {
    try {
      const parsed: unknown = JSON.parse(values);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const v: Record<string, string> = {};
        for (const [k, val] of Object.entries(parsed as Record<string, unknown>)) {
          if (typeof val === 'string') v[k] = val;
        }
        out.values = v;
      }
    } catch {
      /* 忽略非法 JSON */
    }
  }
  return out;
}

function initialState(): PlateState {
  const fromUrl = readUrl();
  const region = fromUrl.region ?? 'CN';
  const typeId = fromUrl.typeId ?? DEFAULT_TYPE[region];
  const type = getPlateType(typeId);
  // URL 值优先，缺省字段用类型默认值补齐
  const values = { ...type.defaults, ...(fromUrl.values ?? {}) };
  return {
    region,
    typeId,
    values,
    exportLongEdge: fromUrl.exportLongEdge ?? 3840,
    showScrews: fromUrl.showScrews ?? true,
    emboss: fromUrl.emboss ?? false,
  };
}

/** 把状态写回 URL（debounce 由调用处控制，这里直接 replaceState）。 */
function writeUrl(state: PlateState): void {
  if (typeof window === 'undefined') return;
  const p = new URLSearchParams();
  p.set(
    CONFIG_PARAM,
    encodePlateConfig({
      region: state.region,
      typeId: state.typeId,
      values: state.values,
      showScrews: state.showScrews,
      emboss: state.emboss,
      exportLongEdge: state.exportLongEdge,
    }),
  );
  const url = `${window.location.pathname}?${p.toString()}`;
  window.history.replaceState(null, '', url);
}

let writeTimer: ReturnType<typeof setTimeout> | undefined;
function scheduleWrite(state: PlateState): void {
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = setTimeout(() => writeUrl(state), 150);
}

export const usePlateStore = create<PlateState & PlateActions>((set, get) => ({
  ...initialState(),

  setRegion: (region) => {
    const typeId = DEFAULT_TYPE[region];
    const type = getPlateType(typeId);
    const next = { region, typeId, values: { ...type.defaults } };
    set(next);
    scheduleWrite({ ...get(), ...next });
  },

  setType: (typeId) => {
    const type = getPlateType(typeId);
    const region = TYPE_TO_REGION[typeId] ?? get().region;
    // 切换类型时用该类型的默认值（各类型字段集不同，不跨类型复用）
    const next = { typeId, values: { ...type.defaults }, region };
    set(next);
    scheduleWrite({ ...get(), ...next });
  },

  setField: (key, value) => {
    const next = { values: { ...get().values, [key]: value } };
    set(next);
    scheduleWrite({ ...get(), ...next });
  },

  setExportLongEdge: (px) => {
    set({ exportLongEdge: px });
    scheduleWrite(get());
  },
  setShowScrews: (v) => {
    set({ showScrews: v });
    scheduleWrite(get());
  },
  setEmboss: (v) => {
    set({ emboss: v });
    scheduleWrite(get());
  },

  reset: () => {
    const s = initialState();
    set({ region: s.region, typeId: s.typeId, values: s.values });
    scheduleWrite(get());
  },

  applySample: () => {
    const type = getPlateType(get().typeId);
    const values = { ...type.defaults };
    // sample 是展示串，这里直接用 defaults 填充各字段
    set({ values });
    scheduleWrite(get());
  },
}));

/** 派生选择器：当前 PlateType。 */
export const selectType = (s: PlateState) => TYPE_REGISTRY[s.typeId];
