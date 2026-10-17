import {
  SEASONS,
  SEASON_LABEL,
  isHemisphere,
  isSeason,
  resolveSeason,
  type Hemisphere,
  type Season,
} from '../lib/season';

const THEME_KEY = 'mori-theme';
const SEASON_KEY = 'mori-season';

/** 标签页可能连着开好几天，隔一阵子重新对一次节气。 */
const SEASON_RECHECK_MS = 15 * 60 * 1000;

type Theme = 'light' | 'dark';
type SeasonMode = 'auto' | 'manual';

function readStore(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}

function writeStore(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {}
}

interface PickerConfig {
  /** 对应 <PickerMenu name={...}>，用来找 DOM */
  name: string;
  /** 菜单标题，也是按钮 aria-label 的前缀 */
  label: string;
  /** 「自动」那一项的文案，用在按钮提示里 */
  autoLabel: string;
  /** 具体选项（不含「自动」），用来把值翻译成文案 */
  choices: Array<{ value: string; label: string }>;
  /** 当前选中值：'auto' 或某个具体值 */
  current: () => string;
  /** 自动时实际生效的值 */
  effective: () => string;
  /** 用户选了某一项 */
  choose: (value: string) => void;
}

/**
 * 「按钮 + 菜单」选择器的交互：展开收起、键盘导航、点选，以及 aria 状态和按钮提示。
 * 明暗主题与季节主题共用这套行为，各自只提供状态与文案。
 * 按钮里的图标由 CSS 按 data-* 状态决定显示哪个，所以这里不碰图标。
 */
function createPicker(config: PickerConfig) {
  const { name, label, autoLabel, choices, current, effective, choose } = config;
  const picker = document.querySelector<HTMLElement>(`[data-picker="${name}"]`);
  const toggle = picker?.querySelector<HTMLButtonElement>('[data-picker-toggle]');
  const menu = picker?.querySelector<HTMLElement>('[data-picker-menu]');
  if (!picker || !toggle || !menu) return null;

  const options = Array.from(menu.querySelectorAll<HTMLButtonElement>('[data-picker-option]'));
  const labelOf = (value: string) => choices.find((choice) => choice.value === value)?.label ?? value;

  const sync = () => {
    const value = current();
    for (const option of options) {
      option.setAttribute('aria-checked', String(option.dataset.pickerOption === value));
    }
    const description = value === 'auto'
      ? `${autoLabel}（当前 ${labelOf(effective())}）`
      : `已选择${labelOf(value)}`;
    toggle.setAttribute('aria-label', `${label}：${description}`);
    toggle.setAttribute('title', `${label}：${description}`);
  };

  const open = (target: 'checked' | 'first' | 'last' = 'checked') => {
    menu.hidden = false;
    toggle.setAttribute('aria-expanded', 'true');
    const checked = options.find((option) => option.getAttribute('aria-checked') === 'true');
    const pick = target === 'first' ? options[0] : target === 'last' ? options.at(-1) : checked ?? options[0];
    pick?.focus();
  };

  const close = (restoreFocus = false) => {
    if (menu.hidden) return;
    menu.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
    if (restoreFocus) toggle.focus();
  };

  toggle.addEventListener('click', () => {
    if (menu.hidden) open();
    else close();
  });

  // 上下键直接展开菜单并把焦点送进去，符合菜单按钮的常见预期。
  toggle.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    open(event.key === 'ArrowDown' ? 'first' : 'last');
  });

  menu.addEventListener('keydown', (event) => {
    const index = options.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === 'Escape') { event.preventDefault(); close(true); return; }
    if (event.key === 'Tab') { close(); return; }
    if (event.key === 'Home') { event.preventDefault(); options[0]?.focus(); return; }
    if (event.key === 'End') { event.preventDefault(); options.at(-1)?.focus(); return; }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const step = event.key === 'ArrowDown' ? 1 : -1;
    options[(index + step + options.length) % options.length]?.focus();
  });

  for (const option of options) {
    option.addEventListener('click', () => {
      const value = option.dataset.pickerOption;
      if (value) choose(value);
      close(true);
    });
  }

  // 点到菜单外面、或者焦点跑掉了就收起来。
  document.addEventListener('pointerdown', (event) => {
    if (menu.hidden) return;
    const target = event.target as Node;
    if (!menu.contains(target) && !toggle.contains(target)) close();
  });

  document.addEventListener('focusin', (event) => {
    if (menu.hidden) return;
    const target = event.target as Node;
    if (!menu.contains(target) && !toggle.contains(target)) close();
  });

  return { sync };
}

export function initTheme() {
  const root = document.documentElement;
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const browserColorMeta = document.querySelector('meta[name="theme-color"]');
  const announce = () => window.dispatchEvent(new CustomEvent('themechange'));

  /** 浏览器 UI 的颜色跟着实际背景走，明暗与四季都能对上。 */
  const syncBrowserColor = () => {
    const bg = getComputedStyle(root).getPropertyValue('--bg').trim();
    browserColorMeta?.setAttribute('content', bg || '#f8faf7');
  };

  // ---- 明暗主题：跟随系统 / 浅色 / 深色 ----
  // 没有 mori-theme 这个键就是「跟随系统」，这也是首次访问的默认行为。
  const storedTheme = (): Theme | null => {
    const value = readStore(THEME_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  };
  const systemTheme = (): Theme => (media.matches ? 'dark' : 'light');
  const effectiveTheme = (): Theme => (root.dataset.theme === 'dark' ? 'dark' : 'light');

  const applyTheme = (theme: Theme) => {
    root.dataset.theme = theme;
    // CSS 靠 data-theme-mode 决定按钮显示哪个图标，所以先写状态再同步提示。
    root.dataset.themeMode = storedTheme() ? 'manual' : 'auto';
    themePicker?.sync();
    syncBrowserColor();
    announce();
  };

  const themePicker = createPicker({
    name: 'theme',
    label: '明暗主题',
    autoLabel: '跟随系统',
    choices: [{ value: 'light', label: '浅色' }, { value: 'dark', label: '深色' }],
    current: () => storedTheme() ?? 'auto',
    effective: effectiveTheme,
    choose: (value) => {
      writeStore(THEME_KEY, value === 'auto' ? null : value);
      applyTheme(value === 'light' || value === 'dark' ? value : systemTheme());
    },
  });

  media.addEventListener('change', () => {
    if (storedTheme()) return; // 手动选过就不跟系统了
    applyTheme(systemTheme());
  });

  applyTheme(effectiveTheme());
  initSeason();

  // ---- 季节主题：跟随节气 / 四季 ----
  function initSeason() {
    const hemisphere: Hemisphere = isHemisphere(root.dataset.seasonHemisphere)
      ? root.dataset.seasonHemisphere
      : 'auto';
    let current: { season: Season; mode: SeasonMode } | null = null;

    const timeZone = () => {
      try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return undefined; }
    };

    /** ?season=autumn 之类的预览参数，只影响当次加载，不会写进 localStorage。 */
    const previewSeason = (): Season | null => {
      try {
        const value = new URLSearchParams(location.search).get('season');
        return isSeason(value) ? value : null;
      } catch { return null; }
    };

    const lockedSeason = (): Season | null => {
      const value = readStore(SEASON_KEY);
      return isSeason(value) ? value : null;
    };

    /** 预览参数只对本次浏览有效，用户一旦自己选过就从地址栏清掉。 */
    const clearPreview = () => {
      if (!previewSeason()) return;
      try {
        const url = new URL(location.href);
        url.searchParams.delete('season');
        history.replaceState(history.state, '', url);
      } catch {}
    };

    const applySeason = (season: Season, mode: SeasonMode) => {
      current = { season, mode };
      root.dataset.season = season;
      root.dataset.seasonMode = mode;
      seasonPicker?.sync();
      syncBrowserColor();
      announce();
    };

    /** 重新判定当前该用哪个季节：预览参数 > 手动锁定 > 按节气自动算。 */
    const refreshSeason = () => {
      const pinned = previewSeason() ?? lockedSeason();
      const mode: SeasonMode = pinned ? 'manual' : 'auto';
      const season = pinned ?? resolveSeason(Date.now(), timeZone(), hemisphere);
      if (current && current.season === season && current.mode === mode) return;
      applySeason(season, mode);
    };

    const seasonPicker = createPicker({
      name: 'season',
      label: '季节主题',
      autoLabel: '跟随节气',
      choices: SEASONS.map((season) => ({ value: season, label: `${SEASON_LABEL[season]}季` })),
      current: () => previewSeason() ?? lockedSeason() ?? 'auto',
      effective: () => (isSeason(root.dataset.season) ? root.dataset.season : 'spring'),
      choose: (value) => {
        writeStore(SEASON_KEY, value === 'auto' ? null : value);
        clearPreview();
        refreshSeason();
      },
    });
    if (!seasonPicker) return;

    refreshSeason();

    // 跨过交节时刻就自动换季；标签页回到前台时也补一次判定。
    window.setInterval(() => { if (!document.hidden) refreshSeason(); }, SEASON_RECHECK_MS);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshSeason(); });
  }
}
