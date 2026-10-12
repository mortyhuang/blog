/**
 * 日历页的纯逻辑：日期运算、法定假期 / 调休判定、年度进度与两组倒计时。
 *
 * 这个模块同时运行在构建时的 Node 和浏览器里，所以不要在这里 import
 * lunar-javascript 或任何只在服务端可用的依赖。
 */

export interface HolidayItem {
  Name: string;
  StartDate: string;
  EndDate: string;
  Duration?: number;
  CompDays?: string[];
  URL?: string;
  Memo?: string;
}

export interface HolidayData {
  Years: Record<string, HolidayItem[]>;
}

export type DayKind = 'holiday' | 'work';
export interface DayFlag {
  kind: DayKind;
  name: string;
}
export type DayFlags = Map<string, DayFlag>;

export interface WageRow {
  label: string;
  info: string;
  daysLeft: number;
  isToday: boolean;
  /** 本发薪周期的进度：上一次发薪到这次发薪之间已经过去的比例，发薪当天算满格。 */
  ratio: number;
  /** 本周期的总天数（上一次发薪 → 这次发薪）与其中已过的天数。 */
  cycleDays: number;
  elapsedDays: number;
}

/** 发薪日设置：每月的几号（可多选）以及要不要算上当月最后一个工作日。 */
export interface PaySpec {
  days: number[];
  lastWorkDay: boolean;
}

export const DEFAULT_PAY_SPEC: PaySpec = { days: [10], lastWorkDay: false };

export interface HolidayRow {
  label: string;
  info: string;
  start: string;
  status: 'upcoming' | 'ongoing';
  daysLeft: number;
  totalDays: number;
  ratio: number;
}

export interface YearProgress {
  year: number;
  percent: number;
  passed: number;
  remaining: number;
  total: number;
  isCurrent: boolean;
}

const DAY_MS = 86_400_000;
const WORKDAY_GUARD = 40;

export const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'];
export const WEEKDAY_NAMES = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

/* ---------------------------------------------------------------- 日期工具 */

export function dayNumber(date: Date): number {
  return Math.round(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS);
}

export function fromDayNumber(value: number): Date {
  const utc = new Date(value * DAY_MS);
  return new Date(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate());
}

export function toYmd(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function fromYmd(ymd: string): Date {
  const [year, month, day] = ymd.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function addDays(date: Date, days: number): Date {
  return fromDayNumber(dayNumber(date) + days);
}

export function diffDays(later: Date, earlier: Date): number {
  return dayNumber(later) - dayNumber(earlier);
}

export function isWeekend(date: Date): boolean {
  const weekday = date.getDay();
  return weekday === 0 || weekday === 6;
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInYear(year: number): number {
  return isLeapYear(year) ? 366 : 365;
}

export function dayOfYear(date: Date): number {
  return diffDays(date, new Date(date.getFullYear(), 0, 1)) + 1;
}

export function formatMonthDay(date: Date): string {
  return `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/* ------------------------------------------------------------ 假期与工作日 */

export function dataYears(data: HolidayData): number[] {
  return Object.keys(data.Years)
    .map(Number)
    .filter((year) => Number.isInteger(year))
    .sort((a, b) => a - b);
}

export function holidayItems(data: HolidayData, years?: number[]): HolidayItem[] {
  const list = years ?? dataYears(data);
  return list
    .flatMap((year) => data.Years[String(year)] ?? [])
    .slice()
    .sort((a, b) => a.StartDate.localeCompare(b.StartDate));
}

/** 把放假区间和调休上班日记成一张查找表，键为 `YYYY-MM-DD`。 */
export function buildDayFlags(data: HolidayData): DayFlags {
  const flags: DayFlags = new Map();
  for (const item of holidayItems(data)) {
    const start = dayNumber(fromYmd(item.StartDate));
    const end = dayNumber(fromYmd(item.EndDate));
    for (let day = start; day <= end; day += 1) {
      flags.set(toYmd(fromDayNumber(day)), { kind: 'holiday', name: item.Name });
    }
    for (const comp of item.CompDays ?? []) {
      flags.set(comp, { kind: 'work', name: item.Name });
    }
  }
  return flags;
}

export function isWorkDay(date: Date, flags: DayFlags): boolean {
  const flag = flags.get(toYmd(date));
  if (flag) return flag.kind === 'work';
  return !isWeekend(date);
}

export function nextWorkDay(date: Date, flags: DayFlags): Date {
  let cursor = date;
  for (let step = 0; step < WORKDAY_GUARD && !isWorkDay(cursor, flags); step += 1) {
    cursor = addDays(cursor, 1);
  }
  return cursor;
}

export function lastWorkDayOfMonth(date: Date, flags: DayFlags): Date {
  let cursor = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  for (let step = 0; step < WORKDAY_GUARD && !isWorkDay(cursor, flags); step += 1) {
    cursor = addDays(cursor, -1);
  }
  return cursor;
}

/** 把外部（localStorage）读到的值收敛成可用的发薪日设置。 */
export function normalizePaySpec(value: unknown): PaySpec {
  if (!value || typeof value !== 'object') return { ...DEFAULT_PAY_SPEC };
  const source = value as Partial<PaySpec>;
  const days = Array.isArray(source.days)
    ? [...new Set(source.days.map(Number).filter((day) => Number.isInteger(day) && day >= 1 && day <= 31))].sort((a, b) => a - b)
    : [];
  return { days, lastWorkDay: source.lastWorkDay === true };
}

/* -------------------------------------------------------------- 发薪倒计时 */

/** 某个月里设置的发薪日（还没顺延）：数字的按当月实际天数截断，「最后工作日」按工作日回推。 */
function paydayInMonth(monthAnchor: Date, day: number | 'last', flags: DayFlags): Date {
  if (day === 'last') return lastWorkDayOfMonth(monthAnchor, flags);
  const lastDayOfMonth = new Date(monthAnchor.getFullYear(), monthAnchor.getMonth() + 1, 0).getDate();
  return new Date(monthAnchor.getFullYear(), monthAnchor.getMonth(), Math.min(day, lastDayOfMonth));
}

/** 设置的发薪日，加上撞上周末或法定假期后顺延得到的实际到账日。 */
interface PaydaySlot {
  raw: Date;
  actual: Date;
}

/** 前后各两个月里的发薪日，按实际到账日升序排列，保证今天两侧都至少有一次。 */
function paydaySlots(today: Date, target: number | 'last', flags: DayFlags): PaydaySlot[] {
  const slots: PaydaySlot[] = [];
  for (let offset = -2; offset <= 2; offset += 1) {
    const anchor = new Date(today.getFullYear(), today.getMonth() + offset, 1);
    const raw = paydayInMonth(anchor, target, flags);
    slots.push({ raw, actual: nextWorkDay(raw, flags) });
  }
  return slots.sort((a, b) => diffDays(a.actual, b.actual));
}

/**
 * 按设置里的发薪日列出倒计时；撞上周末或法定假期时顺延到下一个工作日。
 * 每月的「最后工作日」可以单独打开。
 *
 * 进度条按「上一次发薪 → 这次发薪」这一个周期算：分母是这个周期的总天数，
 * 分子是从上一次发薪到今天已经过去的天数，所以发薪当天刚好满格。
 */
export function getWageRows(today: Date, flags: DayFlags, spec: PaySpec = DEFAULT_PAY_SPEC): WageRow[] {
  const preset = normalizePaySpec(spec);
  const targets: (number | 'last')[] = preset.lastWorkDay ? [...preset.days, 'last'] : preset.days;
  if (targets.length === 0) return [];

  const rows = targets.map((target) => {
    const label = target === 'last' ? '最后工作日' : `${target}号`;
    const slots = paydaySlots(today, target, flags);
    // 下一次发薪按顺延后的实际到账日比较，发薪当天也还在本周期里。
    const found = slots.findIndex((slot) => diffDays(slot.actual, today) >= 0);
    const index = found === -1 ? slots.length - 1 : found;
    const next = slots[index];
    const previous = slots[Math.max(0, index - 1)];

    const cycleDays = Math.max(1, diffDays(next.actual, previous.actual));
    const elapsedDays = Math.min(cycleDays, Math.max(0, diffDays(today, previous.actual)));
    const daysLeft = diffDays(next.actual, today);
    const base = { label, ratio: elapsedDays / cycleDays, cycleDays, elapsedDays };

    if (daysLeft === 0) {
      return { ...base, info: '今天发', daysLeft: 0, isToday: true };
    }

    const shifted = diffDays(next.actual, next.raw) > 0;
    const info = `还有${daysLeft}天${shifted ? `（顺延至${formatMonthDay(next.actual)}）` : ''}`;
    return { ...base, info, daysLeft, isToday: false };
  });

  return rows.sort((a, b) => a.daysLeft - b.daysLeft || a.label.localeCompare(b.label));
}

/* -------------------------------------------------------------- 假期倒计时 */

export function getHolidayRows(today: Date, data: HolidayData): HolidayRow[] {
  const todayNumber = dayNumber(today);
  const rows: HolidayRow[] = [];

  for (const item of holidayItems(data)) {
    const start = dayNumber(fromYmd(item.StartDate));
    const end = dayNumber(fromYmd(item.EndDate));
    if (todayNumber > end) continue;

    const totalDays = end - start + 1;
    if (todayNumber < start) {
      const daysLeft = start - todayNumber;
      rows.push({ label: item.Name, info: `还有${daysLeft}天（共${totalDays}天）`, start: item.StartDate, status: 'upcoming', daysLeft, totalDays, ratio: 0 });
    } else {
      const remaining = end - todayNumber + 1;
      rows.push({ label: item.Name, info: `假期中 还剩${remaining}天`, start: item.StartDate, status: 'ongoing', daysLeft: remaining, totalDays, ratio: remaining / totalDays });
    }
  }

  const maxDays = Math.max(1, ...rows.filter((row) => row.status === 'upcoming').map((row) => row.daysLeft));
  for (const row of rows) {
    if (row.status === 'upcoming') row.ratio = Math.max(0, Math.min(1, 1 - row.daysLeft / maxDays));
  }
  return rows;
}

/* ---------------------------------------------------------------- 假期统计 */

export interface HolidayStatsItem {
  name: string;
  startDate: string;
  endDate: string;
  /** 放假天数（按日期区间计算，元旦等跨年假期也正确） */
  days: number;
  compDays: number;
  compDates: string[];
  status: 'upcoming' | 'ongoing' | 'past';
}

export interface HolidayStats {
  year: number;
  /** 法定假期总天数 */
  holidays: number;
  /** 调休上班天数 */
  comp: number;
  /** 法定假期减去调休上班，实际休假的天数 */
  net: number;
  items: HolidayStatsItem[];
}

/** 一年的假期与调休汇总；取该年份公告里的完整安排（元旦可能跨年）。 */
export function getHolidayStats(year: number, data: HolidayData, today: Date): HolidayStats {
  const todayNumber = dayNumber(today);
  const items: HolidayStatsItem[] = holidayItems(data, [year]).map((item) => {
    const start = dayNumber(fromYmd(item.StartDate));
    const end = dayNumber(fromYmd(item.EndDate));
    const compDates = item.CompDays ?? [];
    return {
      name: item.Name,
      startDate: item.StartDate,
      endDate: item.EndDate,
      days: Math.max(1, end - start + 1),
      compDays: compDates.length,
      compDates,
      status: todayNumber > end ? 'past' : todayNumber >= start ? 'ongoing' : 'upcoming',
    };
  });
  const holidays = items.reduce((sum, item) => sum + item.days, 0);
  const comp = items.reduce((sum, item) => sum + item.compDays, 0);
  return { year, holidays, comp, net: holidays - comp, items };
}

/* ---------------------------------------------------------------- 年度进度 */

export function getYearProgress(today: Date, year: number = today.getFullYear()): YearProgress {
  const total = daysInYear(year);
  const currentYear = today.getFullYear();
  const passed = year < currentYear ? total : year > currentYear ? 0 : dayOfYear(today);
  return {
    year,
    percent: Math.round((passed / total) * 100),
    passed,
    remaining: total - passed,
    total,
    isCurrent: year === currentYear,
  };
}
