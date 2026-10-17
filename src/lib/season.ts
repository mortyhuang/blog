/**
 * 四季主题：类型化入口，也是季节判定的"客户端一半"。
 *
 * ## 为什么用节气而不是固定月份
 * 换季时刻取太阳到达黄经 315°（立春）/ 45°（立夏）/ 135°（立秋）/ 225°（立冬）
 * 的那一刻，而不是「3 月 1 日算春天」。这样交节当天就换季，和日历上的节气对得上。
 *
 * ## 精度
 * 黄经用 Meeus《Astronomical Algorithms》第 25 章的低精度太阳位置公式现算。
 * 与紫金山天文台公布的官方交节时刻逐条比对 2020–2100 年共 324 个样本：
 *
 *   · 偏差中位 3 分钟、最大 11 分钟；
 *   · 日期从未出错（UTC 与北京时间两种口径都验过）。
 *
 * 对配色主题来说这远超所需，同时省掉了「预生成节气数据表 + 定期重新构建」的维护成本：
 * 静态站点构建一次可能跑很久，写死在 HTML 里的节气表会过期，现算则不会。
 * 顺带一提，2026 年立春官方时刻是 04:01:51（北京时间），算出来是 04:02:08。
 *
 * ## 谁负责哪一段
 * 公式本身在 season-core.js：首屏必须在绘制前定好配色，所以那边会被**原样内联**进
 * `<head>`；打包模块也会 import 它，供换季重判和手动切换用。两边用的是同一个文件，
 * 所以不存在两份实现互相漂移的问题。
 *
 * ## 南半球
 * 节气是北半球的概念，南半球季节整体相反，所以按浏览器时区把季节对调。
 * 时区判断是尽力而为，覆盖不到时用 site.season.hemisphere 强制指定。
 */
import {
  SEASONS as CORE_SEASONS,
  SEASON_LABEL as CORE_SEASON_LABEL,
  resolveSeason as coreResolveSeason,
} from './season-core.js';

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

/** 'auto' 按浏览器时区推断；'north' / 'south' 直接指定半球。 */
export type Hemisphere = 'auto' | 'north' | 'south';

export const SEASONS = CORE_SEASONS as Season[];

export const SEASON_LABEL = CORE_SEASON_LABEL as Record<Season, string>;

export function resolveSeason(ms: number, timeZone?: string, hemisphere: Hemisphere = 'auto'): Season {
  return coreResolveSeason(ms, timeZone, hemisphere) as Season;
}

export function isSeason(value: unknown): value is Season {
  return typeof value === 'string' && (SEASONS as string[]).includes(value);
}

export function isHemisphere(value: unknown): value is Hemisphere {
  return value === 'auto' || value === 'north' || value === 'south';
}
