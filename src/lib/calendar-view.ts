/**
 * 日历页的 HTML 片段渲染。构建时用 set:html 输出，浏览器里用 innerHTML 复用同一份标记，
 * 保证首屏与交互后的 DOM 结构完全一致。
 */

import {
  WEEKDAY_NAMES,
  addDays,
  formatMonthDay,
  fromYmd,
  toYmd,
  type HolidayRow,
  type HolidayStats,
  type PaySpec,
  type WageRow,
  type YearProgress,
} from './holidays';

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(value: string): string {
  return String(value).replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
}

function renderBar(ratio: number, tone: 'default' | 'holiday' | 'wage' = 'default'): string {
  const width = Math.round(Math.max(0, Math.min(1, ratio)) * 100);
  const cls = tone === 'default' ? 'hc-bar' : `hc-bar is-${tone}`;
  return `<span class="${cls}" aria-hidden="true"><span class="hc-bar-fill" style="width:${width}%"></span></span>`;
}

export function formatTodayLabel(today: Date): string {
  return `${toYmd(today).replaceAll('-', '.')} · ${WEEKDAY_NAMES[today.getDay()]}`;
}

/** 紧凑的日期区间：同一天只写一次，跨天写成 `MM-DD~MM-DD`。 */
function formatRange(start: string, end: string): string {
  const startLabel = formatMonthDay(fromYmd(start));
  const endLabel = formatMonthDay(fromYmd(end));
  return startLabel === endLabel ? startLabel : `${startLabel}~${endLabel}`;
}

export function renderProgress(progress: YearProgress): string {
  return [
    '<div class="hc-kpi-main">',
    `<strong class="hc-kpi-value">${progress.percent}<small>%</small></strong>`,
    `<span class="hc-kpi-badge">${progress.isCurrent ? '本年进行中' : `${progress.year} 年度`}</span>`,
    '</div>',
    renderBar(progress.percent / 100),
    '<p class="hc-progress-text">',
    `<span>已过 ${progress.passed} / ${progress.total} 天</span>`,
    `<span>剩余 ${progress.remaining} 天</span>`,
    '</p>',
  ].join('');
}

export function renderNextHolidayCard(rows: HolidayRow[]): string {
  const next = rows[0];
  if (!next) {
    return [
      '<div class="hc-kpi-main">',
      '<strong class="hc-kpi-value is-text">待公布</strong>',
      '<span class="hc-kpi-badge">暂无安排</span>',
      '</div>',
      renderBar(0, 'holiday'),
      '<p class="hc-progress-text"><span>等待国务院办公厅最新公告</span></p>',
    ].join('');
  }
  const end = toYmd(addDays(fromYmd(next.start), next.totalDays - 1));
  const unit = next.status === 'ongoing' ? '天剩余' : '天后';
  const badge = next.status === 'ongoing' ? `${escapeHtml(next.label)} · 假期中` : escapeHtml(next.label);
  return [
    '<div class="hc-kpi-main">',
    `<strong class="hc-kpi-value is-holiday">${next.daysLeft}<small>${unit}</small></strong>`,
    `<span class="hc-kpi-badge is-holiday">${badge}</span>`,
    '</div>',
    renderBar(next.ratio, 'holiday'),
    '<p class="hc-progress-text">',
    `<span>${escapeHtml(formatRange(next.start, end))}</span>`,
    `<span>共 ${next.totalDays} 天</span>`,
    '</p>',
  ].join('');
}

export function renderNextWageCard(rows: WageRow[]): string {
  const next = rows[0];
  if (!next) {
    return [
      '<div class="hc-kpi-main">',
      '<strong class="hc-kpi-value is-text">未设置</strong>',
      '<span class="hc-kpi-badge">自定义</span>',
      '</div>',
      renderBar(0, 'wage'),
      '<p class="hc-progress-text"><span>在发薪倒计时模块添加发薪日</span></p>',
    ].join('');
  }
  const ruleLabel = next.label === '最后工作日' ? '最后工作日' : `每月 ${next.label}`;
  const valueMarkup = next.isToday
    ? '<strong class="hc-kpi-value is-text">今天发</strong>'
    : `<strong class="hc-kpi-value">${next.daysLeft}<small>天后</small></strong>`;
  const rightMeta = next.payDate !== next.scheduledDate
    ? `原定 ${formatMonthDay(fromYmd(next.scheduledDate))} 顺延`
    : `本周期 ${next.elapsedDays}/${next.cycleDays} 天`;
  return [
    '<div class="hc-kpi-main">',
    valueMarkup,
    `<span class="hc-kpi-badge">${escapeHtml(ruleLabel)}</span>`,
    '</div>',
    renderBar(next.ratio, 'wage'),
    '<p class="hc-progress-text">',
    `<span>预计 ${formatMonthDay(fromYmd(next.payDate))}</span>`,
    `<span>${escapeHtml(rightMeta)}</span>`,
    '</p>',
  ].join('');
}

export function renderWageRows(rows: WageRow[]): string {
  if (rows.length === 0) {
    return '<p class="hc-empty">还没有发薪日，在上面添加一个吧。</p>';
  }
  const items = rows.map((row) => {
    const classes = `hc-row${row.isToday ? ' is-today' : ''}`;
    const title = `本发薪周期已过 ${row.elapsedDays} / ${row.cycleDays} 天`;
    return `<li class="${classes}" title="${escapeHtml(title)}"><span class="hc-row-label">${escapeHtml(row.label)}</span>${renderBar(row.ratio, 'wage')}<span class="hc-row-info">${escapeHtml(row.info)}</span></li>`;
  });
  return `<ul class="hc-rows">${items.join('')}</ul>`;
}

export function renderHolidayRows(rows: HolidayRow[], currentYear?: number): string {
  if (rows.length === 0) {
    return '<p class="hc-empty">数据范围内已经放完，等下一次国务院公告。</p>';
  }
  const baseYear = currentYear ?? (rows[0] ? Number(rows[0].start.slice(0, 4)) : undefined);
  const items = rows.map((row) => {
    const classes = `hc-row${row.status === 'ongoing' ? ' is-ongoing' : ''}`;
    const rowYear = Number(row.start.slice(0, 4));
    const yearTag = baseYear !== undefined && rowYear > baseYear ? `<small class="hc-row-year">'${String(rowYear).slice(-2)}</small>` : '';
    return `<li class="${classes}"><span class="hc-row-label">${escapeHtml(row.label)}${yearTag}</span>${renderBar(row.ratio, 'holiday')}<span class="hc-row-info">${escapeHtml(row.info)}</span></li>`;
  });
  return `<ul class="hc-rows">${items.join('')}</ul>`;
}

/** 假期统计一天一个小圆点：实心是法定假期，空心是调休上班。 */
function renderDayDots(days: number, compDays: number): string {
  const dots = '<span class="hc-dot is-holiday"></span>'.repeat(days) + '<span class="hc-dot is-comp"></span>'.repeat(compDays);
  const label = `法定假期 ${days} 天${compDays > 0 ? `，调休上班 ${compDays} 天` : ''}`;
  return `<span class="hc-dots" role="img" aria-label="${label}">${dots}</span>`;
}

/** 假期统计：三个汇总数字，下面每个假期一行，用圆点标出假期与调休的天数。 */
export function renderHolidayStats(stats: HolidayStats): string {
  const summary = [
    '<div class="hc-stats">',
    `<div class="hc-stat is-holiday"><span class="hc-stat-head"><span class="hc-dot is-holiday" aria-hidden="true"></span><span>法定假期</span></span><strong>${stats.holidays}<small>天</small></strong></div>`,
    `<div class="hc-stat is-comp"><span class="hc-stat-head"><span class="hc-dot is-comp" aria-hidden="true"></span><span>调休上班</span></span><strong>${stats.comp}<small>天</small></strong></div>`,
    `<div class="hc-stat" title="法定假期减去调休上班，实际休假的天数"><span class="hc-stat-head"><span class="hc-dot is-net" aria-hidden="true"></span><span>实际净休</span></span><strong>${stats.net}<small>天</small></strong></div>`,
    '</div>',
  ].join('');

  if (stats.items.length === 0) {
    return `${summary}<p class="hc-empty">这一年还没有公开安排，等下一次国务院公告。</p>`;
  }

  const rows = stats.items.map((item) => {
    const classes = ['hc-row'];
    if (item.status === 'ongoing') classes.push('is-ongoing');
    if (item.status === 'past') classes.push('is-past');
    const compDates = item.compDates.map((date) => formatMonthDay(fromYmd(date))).join('、');
    const title = `${stats.year}年${formatMonthDay(fromYmd(item.startDate))} 至 ${formatMonthDay(fromYmd(item.endDate))}，放假 ${item.days} 天${item.compDays > 0 ? `；${compDates} 调休上班` : ''}`;
    return `<li class="${classes.join(' ')}" title="${escapeHtml(title)}"><span class="hc-row-label">${escapeHtml(item.name)}</span>${renderDayDots(item.days, item.compDays)}<span class="hc-row-info">${escapeHtml(formatRange(item.startDate, item.endDate))} · ${item.days}天</span></li>`;
  });
  return `${summary}<ul class="hc-rows hc-stat-rows">${rows.join('')}</ul>`;
}

/** 发薪日设置：已选的日子做成可移除的标签，下面是添加表单。 */
export function renderPaySettings(spec: PaySpec, inputValue = '10'): string {
  const chips = [
    ...spec.days.map(
      (day) => `<button type="button" class="hc-pay-chip" data-pay-remove="${day}" aria-label="移除每月 ${day} 号发薪日">${day} 号<span aria-hidden="true"> ×</span></button>`,
    ),
    spec.lastWorkDay
      ? '<button type="button" class="hc-pay-chip" data-pay-last-remove aria-label="移除每月最后工作日发薪日">最后工作日<span aria-hidden="true"> ×</span></button>'
      : '',
  ].join('');
  const chipRow = chips ? `<div class="hc-pay-chips" data-pay-chips role="group" aria-label="已设置的发薪日">${chips}</div>` : '';
  const lastButton = spec.lastWorkDay ? '' : '<button type="button" class="hc-pay-button" data-pay-last>+ 最后工作日</button>';

  return [
    chipRow,
    '<form class="hc-pay-form" data-pay-form>',
    `<label class="hc-pay-label">每月 <input class="hc-pay-input" data-pay-input type="number" min="1" max="31" step="1" value="${escapeHtml(inputValue)}" inputmode="numeric" aria-label="发薪日：每月几号" /> 号</label>`,
    '<button type="submit" class="hc-pay-button is-primary">添加</button>',
    lastButton,
    '</form>',
  ].join('');
}
