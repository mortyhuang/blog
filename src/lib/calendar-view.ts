/**
 * 日历页的 HTML 片段渲染。构建时用 set:html 输出，浏览器里用 innerHTML 复用同一份标记，
 * 保证首屏与交互后的 DOM 结构完全一致。
 */

import { formatMonthDay, fromYmd, parseDaysLeft, type HolidayRow, type HolidayStats, type PaySpec, type WageRow, type YearProgress } from './holidays';

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

function renderBar(ratio: number): string {
  const width = Math.round(Math.max(0, Math.min(1, ratio)) * 100);
  return `<span class="hc-bar" aria-hidden="true"><span class="hc-bar-fill" style="width:${width}%"></span></span>`;
}

export function renderProgress(progress: YearProgress): string {
  return [
    renderBar(progress.percent / 100),
    '<p class="hc-progress-text">',
    `<strong>${progress.percent}%</strong>`,
    `<span>已过 ${progress.passed} / ${progress.total} 天</span>`,
    `<span>剩余 ${progress.remaining} 天</span>`,
    '</p>',
  ].join('');
}

export function renderWageRows(rows: WageRow[]): string {
  if (rows.length === 0) {
    return '<p class="hc-empty">还没有发薪日，在上面添加一个吧。</p>';
  }
  const maxDays = Math.max(1, ...rows.map((row) => parseDaysLeft(row.info) ?? 0));
  const items = rows.map((row) => {
    const days = parseDaysLeft(row.info) ?? 0;
    const ratio = Math.max(0, Math.min(1, 1 - days / maxDays));
    const classes = `hc-row${row.isToday ? ' is-today' : ''}`;
    return `<li class="${classes}"><span class="hc-row-label">${escapeHtml(row.label)}</span>${renderBar(ratio)}<span class="hc-row-info">${escapeHtml(row.info)}</span></li>`;
  });
  return `<ul class="hc-rows">${items.join('')}</ul>`;
}

export function renderHolidayRows(rows: HolidayRow[]): string {
  if (rows.length === 0) {
    return '<p class="hc-empty">数据范围内已经放完，等下一次国务院公告。</p>';
  }
  const items = rows.map((row) => {
    const classes = `hc-row${row.status === 'ongoing' ? ' is-ongoing' : ''}`;
    return `<li class="${classes}"><span class="hc-row-label">${escapeHtml(row.label)}</span>${renderBar(row.ratio)}<span class="hc-row-info">${escapeHtml(row.info)}</span></li>`;
  });
  return `<ul class="hc-rows">${items.join('')}</ul>`;
}

/** 紧凑的日期区间：同一天只写一次，跨天写成 `MM-DD~MM-DD`。 */
function formatRange(start: string, end: string): string {
  const startLabel = formatMonthDay(fromYmd(start));
  const endLabel = formatMonthDay(fromYmd(end));
  return startLabel === endLabel ? startLabel : `${startLabel}~${endLabel}`;
}

/** 假期统计：三个汇总数字，下面每个假期一行，标出日期区间与调休上班日。 */
export function renderHolidayStats(stats: HolidayStats): string {
  const summary = [
    '<div class="hc-stats">',
    `<span class="hc-stat is-holiday"><strong>${stats.holidays}</strong><span>天法定假期</span></span>`,
    `<span class="hc-stat is-comp"><strong>${stats.comp}</strong><span>天调休上班</span></span>`,
    `<span class="hc-stat" title="放假减去补班，实际比标准周末多休的天数"><strong>${stats.net >= 0 ? '+' : ''}${stats.net}</strong><span>天净多休</span></span>`,
    '</div>',
  ].join('');

  if (stats.items.length === 0) {
    return `${summary}<p class="hc-empty">这一年还没有公开安排，等下一次国务院公告。</p>`;
  }

  const maxDays = Math.max(1, ...stats.items.map((item) => item.days));
  const rows = stats.items.map((item) => {
    const classes = ['hc-row'];
    if (item.status === 'ongoing') classes.push('is-ongoing');
    if (item.status === 'past') classes.push('is-past');
    const compDates = item.compDates.map((date) => formatMonthDay(fromYmd(date))).join('、');
    const sub =
      item.compDays > 0
        ? `<span class="hc-row-sub"><span class="hc-comp-flag" aria-hidden="true">班</span>调休上班 ${escapeHtml(compDates)}</span>`
        : '';
    const title = `${stats.year}年${formatMonthDay(fromYmd(item.startDate))} 至 ${item.endDate}，共 ${item.days} 天${item.compDays > 0 ? `；${compDates} 调休上班` : ''}`;
    return `<li class="${classes.join(' ')}" title="${escapeHtml(title)}"><span class="hc-row-label">${escapeHtml(item.name)}</span>${renderBar(item.days / maxDays)}<span class="hc-row-info">${escapeHtml(formatRange(item.startDate, item.endDate))} · ${item.days} 天</span>${sub}</li>`;
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
