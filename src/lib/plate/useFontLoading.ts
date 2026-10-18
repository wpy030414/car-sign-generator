/**
 * 号牌字体加载状态（React hook）。
 *
 * 预览在字体真正可用之前不渲染 SVG，而是显示进度条 —— 否则 font-display:block
 * 期间号牌会先呈现为空白，字体到达后再「跳」出字形。
 *
 * 状态带 `key`（字体集合指纹）：切换号牌类型时，即使 effect 还没跑，
 * 也能在当帧判定「新类型的字体尚未加载」，不会闪出一帧空白号牌。
 */

import { useEffect, useMemo, useState } from 'react';
import { areFontsLoaded, ensureFontsLoaded } from './fonts';
import { fontsOfType } from '@/lib/standards';
import type { FontRef, PlateType } from '@/types/standard';

export interface FontLoadingState {
  /** loading 时预览显示进度条；error 时用回退字形继续渲染 */
  status: 'loading' | 'ready' | 'error';
  ratio: number;
  loadedFonts: number;
  totalFonts: number;
  indeterminate: boolean;
  error?: string;
}

interface InternalState extends FontLoadingState {
  /** 这份状态对应的字体集合指纹 */
  key: string;
}

function fontsKey(fonts: FontRef[]): string {
  return fonts.map((font) => `${font.family}:${font.src}`).join('|');
}

function readyState(totalFonts: number): FontLoadingState {
  return { status: 'ready', ratio: 1, loadedFonts: totalFonts, totalFonts, indeterminate: false };
}

function loadingState(totalFonts: number): FontLoadingState {
  return { status: 'loading', ratio: 0, loadedFonts: 0, totalFonts, indeterminate: false };
}

export function usePlateFontLoading(type: PlateType): FontLoadingState {
  const fonts = useMemo(() => fontsOfType(type), [type]);
  const key = useMemo(() => fontsKey(fonts), [fonts]);
  const [state, setState] = useState<InternalState>(() => ({
    key,
    ...(areFontsLoaded(fonts) ? readyState(fonts.length) : loadingState(fonts.length)),
  }));

  useEffect(() => {
    let alive = true;
    const totalFonts = fonts.length;

    if (totalFonts === 0 || areFontsLoaded(fonts)) {
      setState({ key, ...readyState(totalFonts) });
      return;
    }

    setState({ key, ...loadingState(totalFonts) });
    ensureFontsLoaded(fonts, (progress) => {
      if (!alive) return;
      setState({
        key,
        status: 'loading',
        ratio: progress.ratio,
        loadedFonts: progress.loadedFonts,
        totalFonts: progress.totalFonts,
        indeterminate: progress.indeterminate,
      });
    })
      .then(() => {
        if (alive) setState({ key, ...readyState(totalFonts) });
      })
      .catch((error: unknown) => {
        if (!alive) return;
        // 加载失败不阻塞预览：退回系统字体继续渲染，导出时仍会尝试重新内联
        setState({
          key,
          status: 'error',
          ratio: 1,
          loadedFonts: totalFonts,
          totalFonts,
          indeterminate: false,
          error: error instanceof Error ? error.message : String(error),
        });
      });

    return () => {
      alive = false;
    };
  }, [fonts, key]);

  // 类型已切换但 effect 尚未执行：按当前字体集合即时推导，避免闪一帧空白号牌
  if (state.key !== key) {
    return areFontsLoaded(fonts) ? readyState(fonts.length) : loadingState(fonts.length);
  }
  return state;
}
