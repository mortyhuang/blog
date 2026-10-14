/**
 * 独立排版的日历海报，而不是页面截图。仅在打开分享弹窗时加载，
 * 使用本地数据与 Canvas，不请求图片、不上传发薪设置，也不受页面主题影响。
 */
import { buildMonthCells } from './lunar-calendar';
import { addDays, fromYmd, getHolidayRows, getHolidayStats, getWageRows, getYearProgress, toYmd, WEEKDAY_LABELS, WEEKDAY_NAMES, type DayFlags, type HolidayData, type PaySpec } from './holidays';

export type CalendarShareTheme = 'paper' | 'forest' | 'night';
export interface CalendarShareOptions {
  year: number;
  month: number;
  view: 'year' | 'month';
  theme: CalendarShareTheme;
  lunar: boolean;
  countdowns: boolean;
  paySpec: PaySpec;
  caption: string;
  today: Date;
}

const WIDTH = 1200;
const SCALE = 2;
const COUNTDOWN_SPACE = 200;
const CARD_BRAND = 'themori.space';
const SANS = '"Inter Variable", "PingFang SC", "Microsoft YaHei", sans-serif';
const MONO = '"JetBrains Mono Variable", "PingFang SC", "Microsoft YaHei", monospace';
const MONTH_NAMES = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];
const MONTH_SHORT = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

interface Palette {
  bg: string;
  bottom: string;
  panel: string;
  ink: string;
  muted: string;
  line: string;
  accent: string;
  today: string;
  onAccent: string;
  holiday: string;
  holidayBg: string;
  work: string;
  workBg: string;
}

const PALETTES: Record<CalendarShareTheme, Palette> = {
  paper: {
    bg: '#faf5ed', bottom: '#ede7dc', panel: '#fffcf6', ink: '#38352f', muted: '#81786d',
    line: '#e0d7c9', accent: '#946747', today: '#eee1ce', onAccent: '#fffaf3',
    holiday: '#ac4c43', holidayBg: '#f8e8df', work: '#4c6b8c', workBg: '#e7edf3',
  },
  forest: {
    bg: '#eef3e9', bottom: '#d9e5d5', panel: '#f7faf2', ink: '#244b3b', muted: '#6b8070',
    line: '#cad8c5', accent: '#397552', today: '#deebd5', onAccent: '#f8fff4',
    holiday: '#a44a43', holidayBg: '#f4e5dd', work: '#466c8b', workBg: '#e4edf0',
  },
  night: {
    bg: '#172a3c', bottom: '#0c1927', panel: '#1c3043', ink: '#f0eee7', muted: '#a2b3c3',
    line: '#344b60', accent: '#e6c68b', today: '#39434a', onAccent: '#102136',
    holiday: '#f1aca1', holidayBg: '#493a43', work: '#a7cdec', workBg: '#2b425b',
  },
};

function monthGeometry(year: number, month: number, width: number, detail: boolean) {
  const pad = detail ? 24 : 9;
  const cellWidth = (width - pad * 2) / 7;
  const inset = detail ? 3 : 2;
  const leading = new Date(year, month - 1, 1).getDay();
  const days = new Date(year, month, 0).getDate();
  const rows = detail ? Math.ceil((leading + days) / 7) : 6;
  const dayTop = detail ? 90 : 74;
  return { pad, cellWidth, inset, cellSize: cellWidth - inset * 2, dayTop, rows, height: dayTop + rows * cellWidth + (detail ? 24 : 18) };
}

/** 由实际日期格和内容计算画布高度，四 / 五周的月份不再空出第六周。 */
export function calendarCardLayout(options: CalendarShareOptions) {
  const yearView = options.view === 'year';
  const monthWidth = yearView ? (1056 - 60) / 4 : 1056;
  const month = monthGeometry(options.year, options.month, monthWidth, !yearView);
  const calendarY = 358 + (options.countdowns ? COUNTDOWN_SPACE : 0);
  const calendarHeight = yearView ? month.height * 3 + 40 : month.height;
  const summaryY = calendarY + calendarHeight + 30;
  const summaryHeight = yearView ? 158 : 140;
  const height = Math.ceil((summaryY + summaryHeight + 40 + 96) / 40) * 40;
  return { calendarY, monthWidth, monthHeight: month.height, weekRows: month.rows, summaryY, summaryHeight, height };
}

export function calendarCardDetails(options: CalendarShareOptions) {
  const month = String(options.month).padStart(2, '0');
  const label = options.view === 'year' ? `${options.year} 年全年日历` : `${options.year} 年 ${options.month} 月日历`;
  return {
    label,
    todayLabel: `今日 ${cardDate(toYmd(options.today))} · ${WEEKDAY_NAMES[options.today.getDay()]}`,
    width: WIDTH * SCALE,
    height: calendarCardLayout(options).height * SCALE,
    filename: `themori-space-calendar-${options.year}${options.view === 'month' ? `-${month}` : ''}-${options.theme}.png`,
  };
}

interface ShareCountdown {
  heading: string;
  value: string;
  unit: string;
  detail: string;
  note: string;
}

function cardDate(date: string): string {
  return date.replaceAll('-', '.');
}

/** 与页面的两组倒计时使用同一套规则，始终从今天计算，不随所选历史年份倒退。 */
export function calendarCardCountdowns(today: Date, data: HolidayData, flags: DayFlags, paySpec: PaySpec) {
  const holiday = getHolidayRows(today, data)[0];
  const wage = getWageRows(today, flags, paySpec)[0];
  const holidayCard: ShareCountdown = holiday ? {
    heading: `${holiday.status === 'ongoing' ? '正在放假' : '下次放假'} · ${holiday.label}`,
    value: String(holiday.daysLeft),
    unit: holiday.status === 'ongoing' ? '天假期剩余' : '天后放假',
    detail: `${cardDate(holiday.start)} — ${cardDate(toYmd(addDays(fromYmd(holiday.start), holiday.totalDays - 1)))} · 共 ${holiday.totalDays} 天`,
    note: '法定放假安排（含周末）',
  } : {
    heading: '下次放假', value: '待公布', unit: '',
    detail: '暂无后续法定放假安排', note: '等待下一次国务院办公厅公告',
  };
  const wageCard: ShareCountdown = wage ? {
    heading: '下次发工资',
    value: wage.isToday ? '今天发' : String(wage.daysLeft),
    unit: wage.isToday ? '' : '天后发薪',
    detail: `预计发薪 ${cardDate(wage.payDate)}`,
    note: wage.payDate !== wage.scheduledDate
      ? `原定 ${cardDate(wage.scheduledDate)}，遇休息日顺延`
      : `${wage.label === '最后工作日' ? '每月最后一个工作日' : `每月 ${wage.label}`} · 按页面设置计算`,
  } : {
    heading: '下次发工资', value: '未设置', unit: '',
    detail: '先在页面添加一个发薪日', note: '支持每月几号或最后一个工作日',
  };
  return { holiday: holidayCard, wage: wageCard };
}

function text(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, size: number, color: string, weight = 400, align: CanvasTextAlign = 'left', mono = false) {
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px ${mono ? MONO : SANS}`;
  ctx.textAlign = align;
  ctx.fillText(value, x, y);
}

function fittedText(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, maxWidth: number, size: number, color: string, align: CanvasTextAlign = 'left', minimumSize = size) {
  ctx.font = `400 ${size}px ${SANS}`;
  while (size > minimumSize && ctx.measureText(value).width > maxWidth) {
    size = Math.max(minimumSize, size - 0.5);
    ctx.font = `400 ${size}px ${SANS}`;
  }
  const chars = Array.from(value);
  let label = value;
  while (chars.length > 0 && ctx.measureText(label).width > maxWidth) {
    chars.pop();
    label = `${chars.join('')}…`;
  }
  text(ctx, label, x, y, size, color, 400, align);
}

function box(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number, fill: string, stroke?: string, strokeWidth = 1) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = strokeWidth;
    ctx.stroke();
  }
}

function line(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, color: string) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.stroke();
}

function backdrop(ctx: CanvasRenderingContext2D, height: number, p: Palette) {
  const gradient = ctx.createLinearGradient(0, 0, WIDTH, height);
  gradient.addColorStop(0, p.bg);
  gradient.addColorStop(1, p.bottom);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WIDTH, height);

  // 细纸纹与右上角的日轮：不依赖外部素材，导出永远不会污染 Canvas。
  ctx.save();
  ctx.globalAlpha = 0.17;
  for (let y = 16; y < height; y += 8) line(ctx, 0, y, WIDTH, y, p.line);
  ctx.strokeStyle = p.accent;
  for (const radius of [78, 104, 130]) {
    ctx.beginPath();
    ctx.arc(1060, 174, radius, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(1060, 174, 49, 0, Math.PI * 2);
  ctx.fillStyle = p.accent;
  ctx.fill();
  ctx.restore();
}

function legend(ctx: CanvasRenderingContext2D, p: Palette, offset: number) {
  const items = [
    { x: 72, mark: '休', label: '放假', color: p.holiday, bg: p.holidayBg },
    { x: 210, mark: '班', label: '调休', color: p.work, bg: p.workBg },
    { x: 348, mark: '今', label: '今天', color: p.onAccent, bg: p.accent },
  ];
  for (const item of items) {
    box(ctx, item.x, 303 + offset, 24, 24, 6, item.bg, item.color);
    text(ctx, item.mark, item.x + 12, 320 + offset, 13, item.color, 500, 'center');
    text(ctx, item.label, item.x + 34, 321 + offset, 17, p.muted);
  }
}

function drawCountdowns(ctx: CanvasRenderingContext2D, options: CalendarShareOptions, countdowns: ReturnType<typeof calendarCardCountdowns>, p: Palette) {
  const items = [
    { card: countdowns.holiday, color: p.holiday },
    { card: countdowns.wage, color: p.accent },
  ];
  for (const [index, { card, color }] of items.entries()) {
    const x = 72 + index * 538;
    box(ctx, x, 303, 518, 164, 16, p.panel, p.line);
    box(ctx, x + 24, 328, 4, 17, 2, color);
    fittedText(ctx, card.heading, x + 40, 343, 454, 18, color);
    text(ctx, card.value, x + 24, 400, /^\d+$/.test(card.value) ? 48 : 40, color, 600);
    const valueWidth = ctx.measureText(card.value).width;
    text(ctx, card.unit, x + 24 + valueWidth + 12, 397, 20, p.muted);
    fittedText(ctx, card.detail, x + 24, 429, 470, 18, p.ink);
    fittedText(ctx, card.note, x + 24, 451, 470, 14, p.muted);
  }
  text(ctx, `倒计时截至 ${cardDate(toYmd(options.today))} · 发薪按当前设置计算`, 1128, 491, 14, p.muted, 400, 'right');
}

function drawMonth(ctx: CanvasRenderingContext2D, options: CalendarShareOptions, flags: DayFlags, p: Palette, month: number, x: number, y: number, width: number, detail: boolean) {
  const { pad, cellWidth, inset, cellSize, dayTop, height } = monthGeometry(options.year, month, width, detail);
  box(ctx, x, y, width, height, 16, p.panel, p.line);
  text(ctx, String(month).padStart(2, '0'), x + 18, y + 33, detail ? 26 : 22, p.accent, 500, 'left', true);
  text(ctx, MONTH_NAMES[month - 1], x + (detail ? 72 : 57), y + 32, detail ? 22 : 15, p.ink, 500);
  text(ctx, MONTH_SHORT[month - 1], x + width - 20, y + 31, detail ? 16 : 11, p.muted, 400, 'right', true);

  const startY = y + dayTop;
  for (let column = 0; column < 7; column++) {
    text(ctx, WEEKDAY_LABELS[column], x + pad + (column + 0.5) * cellWidth, y + (detail ? 69 : 60), detail ? 18 : 12, p.muted, 400, 'center');
  }

  const today = toYmd(options.today);
  for (const [index, cell] of buildMonthCells(options.year, month, flags).entries()) {
    if (!cell) continue;
    const left = x + pad + (index % 7) * cellWidth;
    const top = startY + Math.floor(index / 7) * cellWidth;
    const center = left + cellWidth / 2;
    const current = cell.date === today;
    const weekend = index % 7 === 0 || index % 7 === 6;
    const color = current ? p.onAccent : cell.kind === 'holiday' ? p.holiday : cell.kind === 'work' ? p.work : weekend ? p.muted : p.ink;
    const fill = current ? p.accent : cell.kind === 'holiday' ? p.holidayBg : cell.kind === 'work' ? p.workBg : p.bg;
    box(ctx, left + inset, top + inset, cellSize, cellSize, detail ? 12 : 4, fill, current ? p.accent : undefined, 2);

    // 日期数字、农历的基线整行对齐；假期说明独占第三行，避免同一个「元旦」写两遍。
    const note = detail && cell.holidayName && (!options.lunar || cell.kind === 'work' || cell.holidayName !== cell.lunar)
      ? `${cell.holidayName}${cell.kind === 'work' ? '补班' : ''}` : '';
    const dayBaseline = detail ? (options.lunar ? 64 : 82) : (options.lunar ? 16 : 22);
    text(ctx, String(cell.day), center, top + dayBaseline, detail ? 38 : (options.lunar ? 14 : 16), color, current ? 600 : 400, 'center');
    if (options.lunar) fittedText(ctx, cell.lunar, center, top + (detail ? 92 : 27), cellSize - 2, detail ? 16 : 8, color, 'center', detail ? 14 : 6.5);
    if (note) fittedText(ctx, note, center, top + (options.lunar ? 114 : 110), cellSize - 16, 12, color, 'center');

    // 全年小格以底色区分休 / 班，去掉挤在数字与农历之间的微型角标。
    if (detail) {
      if (current) text(ctx, '今日', left + 14, top + 24, 12, p.onAccent, 500);
      if (cell.kind) {
        const mark = cell.kind === 'work' ? '班' : '休';
        const markColor = cell.kind === 'work' ? p.work : p.holiday;
        box(ctx, left + cellWidth - 36, top + 11, 22, 22, 6, cell.kind === 'work' ? p.workBg : p.holidayBg);
        text(ctx, mark, left + cellWidth - 25, top + 27, 11, markColor, 500, 'center');
      }
    }
  }
}

function progressBar(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, ratio: number, p: Palette) {
  box(ctx, x, y, width, height, height / 2, p.line);
  const filled = width * Math.max(0, Math.min(1, ratio));
  if (filled > 0) box(ctx, x, y, filled, height, height / 2, p.accent);
}

/** 单月只保留年度进度；放假、调休的全年汇总只出现在全年海报。 */
function summary(ctx: CanvasRenderingContext2D, options: CalendarShareOptions, data: HolidayData, p: Palette): string {
  const progress = getYearProgress(options.today, options.year);
  const y = calendarCardLayout(options).summaryY;
  const description = `${options.year} 年度进度 ${progress.percent}%，已过 ${progress.passed} / ${progress.total} 天，剩余 ${progress.remaining} 天`;
  const ratio = progress.passed / progress.total;

  if (options.view === 'month') {
    box(ctx, 72, y, 1056, 140, 16, p.panel, p.line);
    text(ctx, `${options.year} 年度进度`, 104, y + 43, 20, p.ink, 500);
    text(ctx, `${progress.percent}%`, 1096, y + 46, 36, p.accent, 600, 'right', true);
    progressBar(ctx, 104, y + 68, 992, 8, ratio, p);
    text(ctx, `已过 ${progress.passed} / ${progress.total} 天`, 104, y + 114, 15, p.muted);
    text(ctx, `剩余 ${progress.remaining} 天`, 1096, y + 114, 15, p.muted, 400, 'right');
    return description;
  }

  const stats = getHolidayStats(options.year, data, options.today);
  box(ctx, 72, y, 1056, 158, 16, p.panel, p.line);
  const items = [
    { value: String(stats.holidays), label: '全年放假安排', color: p.holiday },
    { value: String(stats.comp), label: '全年调休上班', color: p.work },
  ];
  for (const [index, item] of items.entries()) {
    const x = 104 + index * 352;
    text(ctx, item.value, x, y + 64, 36, item.color, 600, 'left', true);
    const valueWidth = ctx.measureText(item.value).width;
    text(ctx, '天', x + valueWidth + 8, y + 63, 16, p.muted);
    text(ctx, item.label, x, y + 93, 15, p.muted);
    line(ctx, x + 320, y + 24, x + 320, y + 134, p.line);
  }
  text(ctx, `${progress.percent}%`, 808, y + 64, 36, p.accent, 600, 'left', true);
  text(ctx, `${options.year} 年度进度`, 808, y + 93, 15, p.muted);
  progressBar(ctx, 808, y + 108, 288, 6, ratio, p);
  text(ctx, `已过 ${progress.passed} / ${progress.total} 天 · 剩余 ${progress.remaining} 天`, 808, y + 135, 12, p.muted);
  return `全年放假安排 ${stats.holidays} 天，全年调休上班 ${stats.comp} 天；${description}`;
}

/** 固定 2 倍分辨率，预览、下载、复制与系统分享复用同一个 PNG。 */
export async function generateCalendarCard(options: CalendarShareOptions, data: HolidayData, flags: DayFlags) {
  const details = calendarCardDetails(options);
  const height = details.height / SCALE;
  const canvas = document.createElement('canvas');
  canvas.width = details.width;
  canvas.height = details.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('浏览器不支持 Canvas 图片生成');
  ctx.scale(SCALE, SCALE);
  const p = PALETTES[options.theme];
  const offset = options.countdowns ? COUNTDOWN_SPACE : 0;
  const countdowns = options.countdowns ? calendarCardCountdowns(options.today, data, flags, options.paySpec) : null;

  backdrop(ctx, height, p);
  text(ctx, CARD_BRAND, 72, 69, 28, p.ink, 650);
  box(ctx, 664, 40, 464, 42, 10, p.today, p.line);
  text(ctx, details.todayLabel, 1112, 69, 20, p.accent, 500, 'right');
  text(ctx, options.view === 'year' ? String(options.year) : `${options.year} / ${String(options.month).padStart(2, '0')}`, 64, 213, options.view === 'year' ? 138 : 108, p.ink, 600);
  fittedText(ctx, options.caption.trim(), 72, 266, 1056, 26, p.muted);
  if (countdowns) drawCountdowns(ctx, options, countdowns, p);
  legend(ctx, p, offset);
  text(ctx, options.view === 'year' ? '一整年的日子，慢慢过。' : `${MONTH_NAMES[options.month - 1]} · 把平凡过成好时光`, 1128, 321 + offset, 17, p.muted, 400, 'right');

  const layout = calendarCardLayout(options);
  if (options.view === 'year') {
    for (let month = 1; month <= 12; month++) {
      drawMonth(ctx, options, flags, p, month, 72 + ((month - 1) % 4) * (layout.monthWidth + 20), layout.calendarY + Math.floor((month - 1) / 4) * (layout.monthHeight + 20), layout.monthWidth, false);
    }
  } else {
    drawMonth(ctx, options, flags, p, options.month, 72, layout.calendarY, layout.monthWidth, true);
  }
  const summaryDescription = summary(ctx, options, data, p);
  line(ctx, 72, height - 96, 1128, height - 96, p.line);
  text(ctx, `${CARD_BRAND} / 全年日历`, 72, height - 62, 17, p.ink, 500);
  text(ctx, `生成于 ${toYmd(options.today).replaceAll('-', '.')}`, 1128, height - 62, 15, p.muted, 400, 'right', true);
  text(ctx, '放假安排含周末，依据国务院办公厅公告 · 农历与节气供参考', 72, height - 32, 13, p.muted);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => value ? resolve(value) : reject(new Error('PNG 编码失败')), 'image/png');
  });
  const countdownSummary = countdowns ? [countdowns.holiday, countdowns.wage]
    .map((item) => `${item.heading}：${item.value}${item.unit}，${item.detail}，${item.note}`).join('；') : '';
  return { ...details, blob, countdownSummary, summaryDescription };
}
