/**
 * 全年月历的构建与渲染：把 12 个月拆成一个个格子，补上农历、节气、节日和假期标记。
 *
 * 这个模块依赖 lunar-javascript，只在构建时和用户切换年份时（动态 import）加载，
 * 不会进入首屏 bundle。
 */

import { Solar, type SolarDate } from 'lunar-javascript';
import { WEEKDAY_LABELS, WEEKDAY_NAMES, fromYmd, isWeekend, toYmd, type DayFlags } from './holidays';
import { escapeHtml } from './calendar-view';

/** 公历节日名超过这个长度时，只写进悬浮提示，不占格子。 */
const SOLAR_FESTIVAL_MAX_LENGTH = 4;

/** 农历库里几个不太适合当格子标签的名字。 */
const SOLAR_FESTIVAL_ALIASES: Record<string, string> = {
  元旦节: '元旦',
};

export interface DayCell {
  date: string;
  day: number;
  lunar: string;
  note: string;
  extra: string;
  title: string;
  kind?: 'holiday' | 'work';
  holidayName?: string;
}

function describeDay(solar: SolarDate): { lunar: string; note: string; extra: string; detail: string } {
  const lunar = solar.getLunar();
  const lunarFestivals = lunar.getFestivals() ?? [];
  const solarFestivals = solar.getFestivals() ?? [];
  const jieQi = lunar.getJieQi();

  let short: string;
  if (lunarFestivals.length > 0) {
    short = lunarFestivals[0];
  } else if (jieQi) {
    short = jieQi;
  } else {
    const solarShort = solarFestivals.find((name) => name.length <= SOLAR_FESTIVAL_MAX_LENGTH);
    if (solarShort) short = SOLAR_FESTIVAL_ALIASES[solarShort] ?? solarShort;
    else if (lunar.getDay() === 1) short = `${lunar.getMonthInChinese()}月`;
    else short = lunar.getDayInChinese();
  }

  const shortLunar = `${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}`;
  const festivals = [...lunarFestivals, ...solarFestivals].join('、');
  return { lunar: short, note: shortLunar, extra: festivals, detail: festivals ? `农历${shortLunar} · ${festivals}` : `农历${shortLunar}` };
}

/** 网页与分享图片共用同一份日期、农历、节气和调休数据。 */
export function buildMonthCells(year: number, month: number, flags: DayFlags): (DayCell | null)[] {
  const cells: (DayCell | null)[] = [];
  const daysInMonth = new Date(year, month, 0).getDate();
  const leading = new Date(year, month - 1, 1).getDay();
  for (let index = 0; index < leading; index += 1) cells.push(null);

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, month - 1, day);
    const ymd = toYmd(date);
    const { lunar, note, extra, detail } = describeDay(Solar.fromYmd(year, month, day));
    const flag = flags.get(ymd);
    const weekday = WEEKDAY_NAMES[date.getDay()];
    const suffix = flag ? (flag.kind === 'work' ? ` · ${flag.name}调休上班` : ` · ${flag.name}假期`) : '';
    cells.push({
      date: ymd,
      day,
      lunar,
      note,
      extra,
      title: `${year}年${month}月${day}日 ${weekday} · ${detail}${suffix}`,
      kind: flag?.kind,
      holidayName: flag?.name,
    });
  }

  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

/** 一年的月历紧凑版；detail 模式只画一个月，多一行农历与节日说明。 */
function renderMonth(year: number, month: number, flags: DayFlags, detail = false): string {
  const cells = buildMonthCells(year, month, flags);
  const today = toYmd(new Date());
  const names = [
    ...new Set(
      cells
        .filter((cell): cell is DayCell => cell !== null && cell.kind === 'holiday')
        .map((cell) => cell.holidayName ?? ''),
    ),
  ].filter(Boolean);

  const weekdays = WEEKDAY_LABELS.map((label, index) => `<span${index === 0 || index === 6 ? ' class="is-weekend"' : ''}>${label}</span>`).join('');
  const days = cells
    .map((cell) => {
      if (!cell) return '<li class="hc-day is-empty" aria-hidden="true"></li>';
      const classes = ['hc-day'];
      if (isWeekend(fromYmd(cell.date))) classes.push('is-weekend');
      if (cell.kind === 'holiday') classes.push('is-holiday');
      if (cell.kind === 'work') classes.push('is-work');
      if (cell.date === today) classes.push('is-today');
      const current = cell.date === today ? ' aria-current="date"' : '';
      const badge = cell.kind ? `<span class="hc-day-flag" aria-hidden="true">${cell.kind === 'work' ? '班' : '休'}</span>` : '';
      const note = detail
        ? `<span class="hc-day-note"><span class="hc-day-note-date">${escapeHtml(cell.note)}</span>${cell.extra ? `<span class="hc-day-note-extra"> · ${escapeHtml(cell.extra)}</span>` : ''}</span>`
        : '';
      return `<li class="${classes.join(' ')}" data-date="${cell.date}"${current} title="${escapeHtml(cell.title)}"><time datetime="${cell.date}"><span class="hc-day-num">${cell.day}</span><span class="hc-day-lunar">${escapeHtml(cell.lunar)}</span>${note}</time>${badge}</li>`;
    })
    .join('');

  const tags = names.length > 0 ? `<span class="hc-month-tags">${names.map((name) => escapeHtml(name)).join(' · ')}</span>` : '';
  const heading = detail ? `${year} 年 ${month} 月` : `${month}月`;
  return `<section class="hc-month" aria-label="${year}年${month}月"><header class="hc-month-head"><h3 class="hc-month-name">${heading}</h3>${tags}</header><div class="hc-weekdays" aria-hidden="true">${weekdays}</div><ol class="hc-days">${days}</ol></section>`;
}

/** 返回某一年 12 个月的完整 HTML。 */
export function renderMonths(year: number, flags: DayFlags): string {
  return Array.from({ length: 12 }, (_, index) => renderMonth(year, index + 1, flags)).join('');
}

/** 返回单独一个月的放大版 HTML。 */
export function renderMonthView(year: number, month: number, flags: DayFlags): string {
  return renderMonth(year, month, flags, true);
}
