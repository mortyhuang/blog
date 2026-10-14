import type { CalendarShareOptions, CalendarShareTheme, generateCalendarCard } from '../lib/calendar-share-card';
import type { DayFlags, HolidayData } from '../lib/holidays';

type Selection = Pick<CalendarShareOptions, 'year' | 'month' | 'view' | 'paySpec'>;
type Card = Awaited<ReturnType<typeof generateCalendarCard>>;
const THEME_KEY = 'mori.year-calendar.share-theme';

function readTheme(): CalendarShareTheme {
  try {
    const theme = localStorage.getItem(THEME_KEY);
    return theme === 'forest' || theme === 'night' ? theme : 'paper';
  } catch {
    return 'paper';
  }
}

export function setupCalendarShare(root: HTMLElement, getSelection: () => Selection, data: HolidayData, flags: DayFlags) {
  const opener = root.querySelector<HTMLButtonElement>('[data-calendar-share-open]');
  const dialog = root.querySelector<HTMLDialogElement>('[data-calendar-share-dialog]');
  if (!opener || !dialog) return;

  const preview = dialog.querySelector<HTMLElement>('[data-share-preview]')!;
  const stage = dialog.querySelector<HTMLElement>('[data-share-stage]')!;
  const placeholder = dialog.querySelector<HTMLElement>('[data-share-placeholder]')!;
  const original = dialog.querySelector<HTMLAnchorElement>('[data-share-original]')!;
  const image = dialog.querySelector<HTMLImageElement>('[data-share-image]')!;
  const status = dialog.querySelector<HTMLElement>('[data-share-status]')!;
  const retry = dialog.querySelector<HTMLButtonElement>('[data-share-retry]')!;
  const download = dialog.querySelector<HTMLButtonElement>('[data-share-download]')!;
  const copy = dialog.querySelector<HTMLButtonElement>('[data-share-copy]')!;
  const share = dialog.querySelector<HTMLButtonElement>('[data-share-native]')!;
  const caption = dialog.querySelector<HTMLInputElement>('[data-share-caption]')!;
  const lunar = dialog.querySelector<HTMLInputElement>('[data-share-lunar]')!;
  const countdowns = dialog.querySelector<HTMLInputElement>('[data-share-countdowns]')!;

  let selection: Selection = getSelection();
  let today = new Date();
  let version = 0;
  let url: string | null = null;
  let file: File | null = null;
  let card: Card | null = null;
  let sharing = false;
  let captionDirty = false;

  copy.hidden = !navigator.clipboard?.write || typeof ClipboardItem === 'undefined' || (typeof ClipboardItem.supports === 'function' && !ClipboardItem.supports('image/png'));
  const supportsFileShare = typeof navigator.share === 'function' && typeof navigator.canShare === 'function';

  function clearPreview() {
    original.hidden = true;
    original.removeAttribute('href');
    image.removeAttribute('src');
    if (url) URL.revokeObjectURL(url);
    url = null;
    file = null;
    card = null;
    download.disabled = copy.disabled = share.disabled = true;
  }

  async function renderPreview() {
    if (!dialog!.open) return;
    captionDirty = false;
    const request = ++version;
    clearPreview();
    placeholder.hidden = false;
    placeholder.textContent = '正在绘制你的日历…';
    preview.setAttribute('aria-busy', 'true');
    retry.hidden = true;
    status.textContent = '正在本地生成高清图片…';

    const view = dialog!.querySelector<HTMLInputElement>('[data-share-view]:checked')?.value === 'month' ? 'month' : 'year';
    const chosenTheme = dialog!.querySelector<HTMLInputElement>('[data-share-theme]:checked')?.value;
    const theme: CalendarShareTheme = chosenTheme === 'forest' || chosenTheme === 'night' ? chosenTheme : 'paper';
    stage.dataset.shareFormat = view;
    const options: CalendarShareOptions = { ...selection, view, theme, caption: caption.value, lunar: lunar.checked, countdowns: countdowns.checked, today };
    try {
      const { generateCalendarCard } = await import('../lib/calendar-share-card');
      await document.fonts.ready;
      // 先让「生成中」状态绘制出来，再执行农历计算与 Canvas 排版。
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      if (request !== version || !dialog!.open) return;
      const result = await generateCalendarCard(options, data, flags);
      if (request !== version || !dialog!.open) return;

      const nextUrl = URL.createObjectURL(result.blob);
      image.src = nextUrl;
      try {
        await image.decode();
      } catch (error) {
        URL.revokeObjectURL(nextUrl);
        throw error;
      }
      if (request !== version || !dialog!.open) {
        URL.revokeObjectURL(nextUrl);
        return;
      }

      url = nextUrl;
      card = result;
      file = new File([result.blob], result.filename, { type: 'image/png' });
      image.alt = `${result.label}分享卡片，含放假、调休与今天标记${options.lunar ? '，显示农历与节气' : ''}。${result.todayLabel}。${result.summaryDescription}${result.countdownSummary ? `。${result.countdownSummary}` : ''}`;
      image.width = result.width;
      image.height = result.height;
      image.dataset.theme = theme;
      original.href = url;
      original.hidden = false;
      placeholder.hidden = true;
      download.disabled = copy.disabled = false;
      // 部分浏览器只有文本分享，所以必须检测文件能力，不能只判断 navigator.share。
      try {
        share.hidden = !supportsFileShare || !navigator.canShare({ files: [file] });
      } catch {
        share.hidden = true;
      }
      share.disabled = sharing;
      status.textContent = `${result.label} · ${result.width} × ${result.height} · PNG`;
    } catch {
      if (request !== version || !dialog!.open) return;
      clearPreview();
      placeholder.textContent = '图片暂时没有生成成功';
      status.textContent = '生成失败，请重试。也可以换一种配色。';
      retry.hidden = false;
    } finally {
      if (request === version) preview.setAttribute('aria-busy', 'false');
    }
  }

  opener.addEventListener('click', () => {
    if (dialog.open) return;
    const current = getSelection();
    selection = { ...current, paySpec: { ...current.paySpec, days: [...current.paySpec.days] } };
    today = new Date();
    const theme = readTheme();
    for (const input of dialog.querySelectorAll<HTMLInputElement>('[data-share-view]')) input.checked = input.value === selection.view;
    for (const input of dialog.querySelectorAll<HTMLInputElement>('[data-share-theme]')) input.checked = input.value === theme;
    dialog.showModal();
    document.body.classList.add('calendar-share-open');
    void renderPreview();
  });

  dialog.querySelector<HTMLButtonElement>('[data-share-close]')!.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  });
  dialog.addEventListener('close', () => {
    // close 事件是排队触发的；若用户已重新打开，不能清掉新一轮预览。
    if (dialog.open) return;
    captionDirty = false;
    version += 1;
    clearPreview();
    preview.setAttribute('aria-busy', 'false');
    document.body.classList.remove('calendar-share-open');
    opener.focus({ preventScroll: true });
  });

  dialog.addEventListener('change', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || target === caption) return;
    if (target.matches('[data-share-theme]')) {
      try { localStorage.setItem(THEME_KEY, target.value); } catch { /* 存储不可用时仍可生成。 */ }
    }
    void renderPreview();
  });
  // 编辑时保留旧预览，不编码 PNG；真正失焦后才生成一次，防止导出旧文案。
  caption.addEventListener('input', () => {
    captionDirty = true;
    version += 1;
    download.disabled = copy.disabled = share.disabled = true;
    preview.setAttribute('aria-busy', 'false');
    status.textContent = '文案编辑中，离开输入框后更新图片。';
    if (original.hidden) placeholder.textContent = '写好一句话，离开输入框后生成图片。';
  });
  caption.addEventListener('blur', () => {
    if (captionDirty && dialog.open) void renderPreview();
  });
  retry.addEventListener('click', () => void renderPreview());

  download.addEventListener('click', () => {
    if (!url || !card) return;
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = card.filename;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    status.textContent = '已开始下载，手机也可以点击预览后长按保存。';
  });

  copy.addEventListener('click', async () => {
    if (!card) return;
    const request = version;
    copy.disabled = true;
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': card.blob })]);
      if (request === version && dialog.open) status.textContent = '图片已复制，可以直接粘贴到聊天窗口。';
    } catch {
      if (request === version && dialog.open) status.textContent = '浏览器未允许复制图片，请使用「下载 PNG」。';
    } finally {
      if (request === version && dialog.open) copy.disabled = false;
    }
  });

  share.addEventListener('click', async () => {
    if (!file || !card || sharing) return;
    const request = version;
    sharing = true;
    share.disabled = true;
    try {
      // 在真实点击中直接调用，保留手机浏览器要求的 transient activation。
      await navigator.share({ files: [file], title: card.label });
      if (request === version && dialog.open) status.textContent = '分享完成，把这一页时光送给朋友。';
    } catch (error) {
      if (request === version && dialog.open && !((error instanceof Error || error instanceof DOMException) && error.name === 'AbortError')) {
        status.textContent = '暂时无法系统分享，请下载图片后发送。';
      }
    } finally {
      sharing = false;
      if (dialog.open && file) share.disabled = false;
    }
  });

  opener.hidden = false;
}
