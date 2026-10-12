/**
 * lunar-javascript 没有随包提供类型声明，这里按日历页用到的接口补一份最小定义。
 */
declare module 'lunar-javascript' {
  export interface LunarDate {
    getYear(): number;
    getMonth(): number;
    getDay(): number;
    getYearInChinese(): string;
    getMonthInChinese(): string;
    getDayInChinese(): string;
    getJieQi(): string;
    getFestivals(): string[];
  }

  export interface SolarDate {
    getLunar(): LunarDate;
    getFestivals(): string[];
    getWeek(): number;
    getWeekInChinese(): string;
    toYmd(): string;
  }

  export const Solar: {
    fromYmd(year: number, month: number, day: number): SolarDate;
    fromDate(date: Date): SolarDate;
  };
}
