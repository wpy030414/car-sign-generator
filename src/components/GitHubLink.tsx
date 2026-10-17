/**
 * 顶部栏右上角的仓库入口。
 *
 * lucide-react 1.x 已不再提供品牌图标（Github 已移除），这里内联 GitHub 官方 mark，
 * 避免为一个图标新增依赖。
 */

import { Button } from '@/components/ui/button';

export const GITHUB_REPO_URL = 'https://github.com/wpy030414/car-sign-generator';

function GitHubMark() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 .5C5.73.5.5 5.73.5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.55v-2.1c-3.2.7-3.88-1.55-3.88-1.55-.53-1.33-1.28-1.69-1.28-1.69-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.03 1.75 2.69 1.25 3.35.96.1-.74.4-1.25.73-1.54-2.56-.29-5.25-1.28-5.25-5.7 0-1.26.45-2.29 1.18-3.09-.12-.29-.51-1.46.11-3.04 0 0 .96-.31 3.14 1.18a10.9 10.9 0 0 1 5.72 0c2.18-1.49 3.14-1.18 3.14-1.18.62 1.58.23 2.75.11 3.04.74.8 1.18 1.83 1.18 3.09 0 4.43-2.7 5.4-5.27 5.69.41.36.78 1.06.78 2.14v3.17c0 .3.2.66.8.55A11.5 11.5 0 0 0 23.5 12C23.5 5.73 18.27.5 12 .5Z" />
    </svg>
  );
}

export function GitHubLink() {
  return (
    <Button asChild variant="ghost" size="sm">
      <a
        href={GITHUB_REPO_URL}
        target="_blank"
        rel="noreferrer noopener"
        aria-label="在 GitHub 上查看本项目"
        title="在 GitHub 上查看本项目"
      >
        <GitHubMark />
        <span className="hidden sm:inline">GitHub</span>
      </a>
    </Button>
  );
}
