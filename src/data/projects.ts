export interface Project {
  id: string;
  title: string;
  description: string;
  href: string;
  cover: 'terrain' | 'orbit' | 'grid' | 'gradient';
  featured?: boolean;
}

export const calendarProject: Project = {
  id: 'year-calendar',
  title: '全年日历',
  description: '一年 12 个月的农历、假期与调休，连同年度进度和倒计时，一次看清。',
  href: '/toys/year-calendar/',
  cover: 'grid',
  featured: true,
};

export const landscapeProject: Project = {
  id: 'noise-landscape',
  title: '噪声地形实验室',
  description: '调节频率与振幅，实时生成一片属于你的线条风景。',
  href: '/toys/noise-landscape/',
  cover: 'terrain',
};

export const knotProject: Project = {
  id: 'trefoil-knot',
  title: '生成式三叶结',
  description: '用数学构建一个缓慢旋转的三维结，让灵感拥有形状。',
  href: '/toys/trefoil-knot/',
  cover: 'orbit',
};

export const flappyKlineProject: Project = {
  id: 'flappy-kline',
  title: 'Flappy K-Line (K线跳跳乐)',
  description: '经典 Flappy Bird 玩法，穿越阻力支撑巨型K线，小鸟经过的地方即时生成真实阴阳烛台与均线走势！',
  href: '/fly/',
  cover: 'gradient',
  featured: true,
};

export const scratchCardProject: Project = {
  id: 'scratch-card',
  title: '幸运刮刮乐',
  description: '四种经典刮刮乐玩法，分区刮开、图符翻倍与奖金累加的免费模拟体验。',
  href: '/toys/scratch-card/',
  cover: 'gradient',
};

// 在这里添加自己的作品或外部项目。
// 顺序决定展示顺序；featured: false 可从首页隐藏，作品页仍会显示。
// 站内地址以 / 开头；外部链接使用完整的 https:// 地址，自动在新标签页打开。
export const projects: Project[] = [calendarProject, flappyKlineProject, scratchCardProject, landscapeProject, knotProject];

export const featuredProjects = projects.filter((project) => project.featured !== false);

export function isExternalProject(project: Project) {
  return /^https?:\/\//i.test(project.href);
}
