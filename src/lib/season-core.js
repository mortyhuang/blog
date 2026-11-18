/**
 * 四季主题的季节判定，以节气（立春 / 立夏 / 立秋 / 立冬）为分界。
 *
 * 会被 BaseLayout 用 `?raw` 原样内联进 <head>，在首次绘制前定好 data-season，
 * 所以：不引入依赖、不写类型语法、注释从简（内联时不会压缩）。
 * 打包模块也会 import 它（换季判定要复用它），因此源码里同一个文件既内联又被打包，
 * 这是有意为之——源码只有一份，不会漂移。
 * 原理、精度验证与使用方式见 src/lib/season.ts 和 README。
 */

/** 一年中的先后顺序。 */
export const SEASONS = ['spring', 'summer', 'autumn', 'winter'];

export const SEASON_LABEL = { spring: '春', summer: '夏', autumn: '秋', winter: '冬' };

/** [季节, 太阳黄经, 这一天在一年中的大致位置]，第三项只用来给二分法划 ±8 天的初始区间。 */
const SOLAR_TERMS = [
  ['spring', 315, 35],
  ['summer', 45, 125],
  ['autumn', 135, 219],
  ['winter', 225, 311],
];

const DEG = Math.PI / 180;
const DAY_MS = 86400000;
const J2000 = 2451545.0;
const UNIX_EPOCH_JD = 2440587.5;
const DELTA_T_MS = 69000; // TT 与 UT 之差，2020–2050 年在 69–75 秒之间，常量足够

const unixMsToJd = (ms) => ms / DAY_MS + UNIX_EPOCH_JD;
const jdToUnixMs = (jd) => (jd - UNIX_EPOCH_JD) * DAY_MS;

/** 太阳视黄经（度），Meeus《Astronomical Algorithms》第 25 章低精度公式。 */
function apparentSolarLongitude(jd) {
  const t = (jd - J2000) / 36525;
  const l0 = (280.46646 + 36000.76983 * t + 0.0003032 * t * t) % 360;
  const m = 357.52911 + 35999.05029 * t - 0.0001537 * t * t;
  const c = (1.914602 - 0.004817 * t - 0.000014 * t * t) * Math.sin(m * DEG)
    + (0.019993 - 0.000101 * t) * Math.sin(2 * m * DEG)
    + 0.000289 * Math.sin(3 * m * DEG);
  const omega = 125.04 - 1934.136 * t;
  const apparent = l0 + c - 0.00569 - 0.00478 * Math.sin(omega * DEG);
  return ((apparent % 360) + 360) % 360;
}

/** 相对目标黄经的偏差，落在 (-180, 180]。黄经单调增加，二分法必然收敛。 */
function longitudeOffset(jd, target) {
  return ((((apparentSolarLongitude(jd) - target + 180) % 360) + 360) % 360) - 180;
}

/** 某一年的某个节气对应的时刻（毫秒时间戳）。 */
function solarTermTime(year, target, approxDay) {
  const yearStart = Date.UTC(year, 0, 1);
  let low = unixMsToJd(yearStart + (approxDay - 8) * DAY_MS);
  let high = unixMsToJd(yearStart + (approxDay + 8) * DAY_MS);
  for (let i = 0; i < 60; i += 1) {
    const mid = (low + high) / 2;
    if (longitudeOffset(mid, target) < 0) low = mid;
    else high = mid;
  }
  return jdToUnixMs((low + high) / 2) - DELTA_T_MS;
}

/** 某个时刻属于哪个季节（北半球口径）。立春之前仍算上一年立冬开始的冬天。 */
export function seasonAt(ms) {
  const year = new Date(ms).getUTCFullYear();
  let season = 'winter';
  for (const [name, target, approxDay] of SOLAR_TERMS) {
    if (ms >= solarTermTime(year, target, approxDay)) season = name;
  }
  return season;
}

/**
 * 南半球的时区。节气是北半球的概念，南半球季节整体相反，所以只需判断"是否南半球"。
 * 靠时区名判断是尽力而为，覆盖不到的时区可以用 site.season.hemisphere 强制指定。
 * 以 `/` 结尾为前缀匹配（整个地区都在南半球），其余为精确时区名。
 */
const SOUTHERN_ZONES = (
  'antarctica/ australia/ america/argentina/ brazil/ chile/ '
  + 'africa/blantyre africa/brazzaville africa/bujumbura africa/dar_es_salaam africa/gaborone '
  + 'africa/harare africa/johannesburg africa/kigali africa/kinshasa africa/luanda '
  + 'africa/lubumbashi africa/lusaka africa/maputo africa/maseru africa/mbabane '
  + 'africa/nairobi africa/windhoek '
  + 'america/araguaina america/asuncion america/bahia america/belem america/buenos_aires '
  + 'america/campo_grande america/cuiaba america/eirunepe america/fortaleza america/guayaquil '
  + 'america/la_paz america/lima america/maceio america/manaus america/montevideo '
  + 'america/noronha america/porto_velho america/punta_arenas america/recife america/rio_branco '
  + 'america/santarem america/santiago america/sao_paulo atlantic/south_georgia '
  + 'indian/antananarivo indian/chagos indian/christmas indian/cocos indian/comoro '
  + 'indian/kerguelen indian/mahe indian/mauritius indian/mayotte indian/reunion '
  + 'pacific/apia pacific/auckland pacific/bougainville pacific/chatham pacific/easter '
  + 'pacific/efate pacific/fakaofo pacific/fiji pacific/funafuti pacific/gambier '
  + 'pacific/guadalcanal pacific/kiritimati pacific/marquesas pacific/nauru pacific/niue '
  + 'pacific/norfolk pacific/noumea pacific/pago_pago pacific/port_moresby pacific/rarotonga '
  + 'pacific/tahiti pacific/tongatapu pacific/wallis'
).split(' ');

export function isSouthernHemisphere(timeZone) {
  const zone = String(timeZone || '').toLowerCase();
  if (!zone) return false;
  return SOUTHERN_ZONES.some((entry) => (
    entry.endsWith('/') ? zone.startsWith(entry) : zone === entry
  ));
}

const OPPOSITE_SEASON = { spring: 'autumn', summer: 'winter', autumn: 'spring', winter: 'summer' };

/** 季节判定入口。hemisphere 传 'north' / 'south' 时跳过时区推断。 */
export function resolveSeason(ms, timeZone, hemisphere) {
  const season = seasonAt(ms);
  const southern = hemisphere === 'south'
    || (hemisphere !== 'north' && isSouthernHemisphere(timeZone));
  return southern ? OPPOSITE_SEASON[season] : season;
}
