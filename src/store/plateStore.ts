/**
 * 号牌编辑状态（Zustand + URL query 持久化）。
 *
 * 选择 Zustand 而非 Context：号牌随每次击键重渲染，Context 会让所有消费者一起重渲染，
 * 而 Zustand 的按键选择器让编辑面板与号牌预览独立更新。
 *
 * URL 持久化：把 region/typeId/字段值写进 query string，任何号牌都是可分享链接。
 */

import { create } from 'zustand';
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
}

interface PlateActions {
  setRegion: (region: Region) => void;
  setType: (typeId: string) => void;
  setField: (key: string, value: string) => void;
  setExportLongEdge: (px: number) => void;
  setShowScrews: (v: boolean) => void;
  reset: () => void;
  /** 用示例值填充当前类型 */
  applySample: () => void;
}

/** 从 URL query 读取初始状态。 */
function readUrl(): Partial<PlateState> {
  if (typeof window === 'undefined') return {};
  const p = new URLSearchParams(window.location.search);
  const out: Partial<PlateState> = {};
  const region = p.get('region') as Region | null;
  if (region && region in STANDARD_BY_REGION) out.region = region;
  const typeId = p.get('type');
  if (typeId && typeId in TYPE_REGISTRY) out.typeId = typeId;
  const values = p.get('values');
  if (values) {
    try {
      out.values = JSON.parse(values);
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
  return { region, typeId, values, exportLongEdge: 3840, showScrews: true };
}

/** 把状态写回 URL（debounce 由调用处控制，这里直接 replaceState）。 */
function writeUrl(state: PlateState): void {
  if (typeof window === 'undefined') return;
  const p = new URLSearchParams();
  p.set('region', state.region);
  p.set('type', state.typeId);
  p.set('values', JSON.stringify(state.values));
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

  setExportLongEdge: (px) => set({ exportLongEdge: px }),
  setShowScrews: (v) => set({ showScrews: v }),

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
