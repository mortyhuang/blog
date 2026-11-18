#!/usr/bin/env node
/**
 * 拉取最新的中国法定节假日安排，写入 src/data/holidays.json。
 * 数据来源：https://github.com/lanceliao/china-holiday-calender
 */
import { writeFile } from 'node:fs/promises';

const SOURCE = 'https://raw.githubusercontent.com/lanceliao/china-holiday-calender/master/holidayAPI.json';
const target = new URL('../src/data/holidays.json', import.meta.url);

const response = await fetch(SOURCE, { headers: { 'User-Agent': 'mori-calendar-updater' } });
if (!response.ok) {
  console.error(`拉取失败：${response.status} ${response.statusText}`);
  process.exit(1);
}

const text = await response.text();
const data = JSON.parse(text);
const years = Object.keys(data.Years ?? {});
if (years.length === 0) {
  console.error('返回的数据里没有 Years 字段，已放弃写入。');
  process.exit(1);
}

await writeFile(target, `${text.trim()}\n`, 'utf8');
console.log(`已更新 ${target.pathname}：覆盖 ${years.join('、')} 年。`);
