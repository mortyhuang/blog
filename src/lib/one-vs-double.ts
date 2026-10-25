/** 一亿 vs 一块钱翻倍：共用的计算与格式化，服务端和交互脚本都用这一份。 */

export const OVD_HORIZON = 48;
export const OVD_DEFAULTS = {
  amount: 100_000_000,
  start: 1,
  rate: 5,
  month: 27,
  interest: true,
} as const;

/** 一次性拿走的那笔钱，第 month 个月的值。interest 关掉时就是本金。 */
export function lumpAt(amount: number, annualRatePercent: number, month: number, interest: boolean) {
  if (!interest) return amount;
  return amount * Math.pow(1 + annualRatePercent / 100 / 12, month);
}

/** 从 start 元开始，每月翻倍，第 month 个月的值。 */
export function doubleAt(start: number, month: number) {
  return start * Math.pow(2, month);
}

/** 翻倍方案第一次追平或超过一次性方案是在第几个月；在范围内没有就返回 -1。 */
export function findCrossover(amount: number, start: number, annualRatePercent: number, interest: boolean, horizon = OVD_HORIZON) {
  for (let month = 0; month <= horizon; month += 1) {
    if (doubleAt(start, month) >= lumpAt(amount, annualRatePercent, month, interest)) return month;
  }
  return -1;
}

const UNITS = [
  { value: 1e16, label: '亿亿' },
  { value: 1e12, label: '万亿' },
  { value: 1e8, label: '亿' },
  { value: 1e4, label: '万' },
];

function scientific(value: number) {
  const exponent = Math.floor(Math.log10(value));
  const mantissa = value / 10 ** exponent;
  return `${Number(mantissa.toFixed(2))}e${exponent}`;
}

function scaledDigits(scaled: number) {
  if (scaled >= 100) return 0;
  if (scaled >= 10) return 1;
  return 2;
}

/** 文章里用的大额格式：1.34 亿、2233.67 万、281.47 万亿。 */
export function formatMoney(value: number) {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1e20) return `${sign}${scientific(abs)} 元`;
  for (const unit of UNITS) {
    if (abs >= unit.value) {
      const scaled = abs / unit.value;
      return `${sign}${scaled.toFixed(scaledDigits(scaled))} ${unit.label}`;
    }
  }
  return `${sign}${new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 0 }).format(abs)} 元`;
}

/** 坐标轴上的紧凑格式：1、100、1万、1亿、100万亿。 */
export function formatCompact(value: number) {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1e20) return `${sign}${scientific(abs)}`;
  for (const unit of UNITS) {
    if (abs >= unit.value) {
      const scaled = abs / unit.value;
      return `${sign}${scaled.toFixed(scaledDigits(scaled)).replace(/\.0+$/, '')}${unit.label}`;
    }
  }
  return `${sign}${new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 0 }).format(abs)}`;
}
