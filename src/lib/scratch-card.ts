export type GameId = 'dragon' | 'five' | 'arena' | 'six';
export interface GameDefinition {
  id: GameId;
  name: string;
  face: number;
  top: number;
  color: string;
  source: string;
  rule: string;
  tiers: number[];
}
export const scratchGames: GameDefinition[] = [
  { id: 'dragon', name: '中国龙', face: 5, top: 100000, color: '#a83732', source: 'https://www.cwl.gov.cn/c/2019/10/17/458989.shtml',
    rule: '任意一个「我的号码」与「中奖号码」相同，获得该号码下方奖金；刮出「龙」图符，获得图符下方奖金。中奖奖金兼中兼得。',
    tiers: [5, 10, 20, 50, 100, 200, 500, 5000, 100000] },
  { id: 'five', name: '5动奇迹', face: 5, top: 100000, color: '#735184', source: 'https://www.cwl.gov.cn/c/2017/11/10/417432.shtml',
    rule: '任意一个「我的号码」与任意一个「中奖号码」相同，获得该号码下方奖金；刮出特殊「5」图符，获得图符下方奖金的5倍。中奖奖金兼中兼得。',
    tiers: [5, 10, 20, 30, 40, 50, 100, 200, 500, 1000, 5000, 100000] },
  { id: 'arena', name: '擂台赛', face: 2, top: 30000, color: '#34675e', source: 'https://www.cwl.gov.cn/c/2017/11/10/417431.shtml',
    rule: '共有4局。在同一局中，「我的点数」大于「对手点数」获得该局奖金；「我的点数」刮出「擂鼓」图符，获得该局奖金的5倍。中奖奖金兼中兼得。',
    tiers: [2, 4, 10, 20, 50, 100, 500, 30000] },
  { id: 'six', name: '翻6倍', face: 20, top: 600000, color: '#94532c', source: 'https://www.cwl.gov.cn/c/2023/11/07/558593.shtml',
    rule: '玩法一：刮出奖金金额即得该奖金。玩法二：共6局，同局3个相同图符得右侧奖金；同局刮出「6」图符得右侧奖金的6倍。玩法三：刮出「赞」图符得60元。三个玩法区中奖奖金兼中兼得。',
    tiers: [20, 30, 40, 50, 60, 100, 120, 180, 240, 300, 360, 600, 1000, 6000, 100000, 600000] },
];

export type ZoneKind = 'reference' | 'number' | 'duel' | 'cash' | 'triple' | 'thumb';
export interface ScratchZone {
  id: string;
  group: string;
  label: string;
  kind: ZoneKind;
  values: string[];
  prize: number;
}
export interface ScratchTicket {
  game: GameId;
  winning: string[];
  zones: ScratchZone[];
}

/** Only ticket contents determine the award; scratching order never changes it. */
export function zoneAward(game: GameId, zone: ScratchZone, winning: string[]): number {
  const [first, second, third] = zone.values;
  switch (zone.kind) {
    case 'reference': return 0;
    case 'number':
      if (game === 'dragon' && first === '龙') return zone.prize;
      if (game === 'five' && first === '5') return zone.prize * 5;
      return winning.includes(first) ? zone.prize : 0;
    case 'duel':
      if (first === '擂鼓') return zone.prize * 5;
      return Number(first) > Number(second) ? zone.prize : 0;
    case 'cash': return zone.prize;
    case 'triple':
      if (zone.values.includes('6')) return zone.prize * 6;
      return first === second && second === third ? zone.prize : 0;
    case 'thumb': return first === '赞' ? 60 : 0;
  }
}
export function ticketAward(ticket: ScratchTicket): number {
  return ticket.zones.reduce((total, zone) => total + zoneAward(ticket.game, zone, ticket.winning), 0);
}

/** Demonstration pool: uniformly chooses 0 or an advertised prize tier, NOT official odds.
 * Layouts and number of number-matching spots are adapted for this web demo.
 */
export function createScratchTicket(game: GameId, random: () => number = Math.random): ScratchTicket {
  const definition = scratchGames.find((item) => item.id === game)!;
  const pick = <T>(items: T[]): T => items[Math.floor(random() * items.length)];
  const amount = pick([0, ...definition.tiers]);
  const zones: ScratchZone[] = [];
  const add = (group: string, kind: ZoneKind, label: string, values: string[], prize = 0) => {
    zones.push({ id: `zone-${zones.length}`, group, kind, label, values, prize });
  };
  // Reserve 5 exclusively for the multiplier symbol in 5动奇迹.
  const numbers = Array.from({ length: 29 }, (_, index) => String(index + 1)).filter((n) => game !== 'five' || n !== '5');
  const shuffled = [...numbers];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const winning = shuffled.slice(0, game === 'five' ? 2 : 1);
  const split = amount > 0 && amount % (definition.face * 2) === 0 && random() < 0.4;
  const awards = amount ? (split ? [amount / 2, amount / 2] : [amount]) : [];
  const spots = game === 'arena' ? 4 : game === 'six' ? 6 : 8;
  const order = Array.from({ length: spots }, (_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const assigned = new Map(awards.map((award, index) => [order[index], award]));

  if (game === 'dragon' || game === 'five') {
    add('中奖号码', 'reference', '中奖号码', winning);
    for (let i = 0; i < spots; i++) {
      const award = assigned.get(i) ?? 0;
      const special = award > 0 && (game === 'dragon' || award % 5 === 0) && random() < 0.4;
      const value = award ? (special ? (game === 'dragon' ? '龙' : '5') : pick(winning)) : pick(shuffled.slice(winning.length));
      add('我的号码', 'number', `我的号码 ${i + 1}`, [value], award ? award / (special && game === 'five' ? 5 : 1) : pick(definition.tiers.slice(0, 5)));
    }
  } else if (game === 'arena') {
    for (let i = 0; i < 4; i++) {
      const award = assigned.get(i) ?? 0;
      const drum = award > 0 && award % 5 === 0 && random() < 0.4;
      const opponent = 2 + Math.floor(random() * 7);
      const mine = drum ? '擂鼓' : String(award ? opponent + 1 : opponent - Math.floor(random() * opponent));
      add('四局擂台赛', 'duel', `第 ${i + 1} 局`, [mine, String(opponent)], award ? award / (drum ? 5 : 1) : pick([2, 4, 10, 20, 50]));
    }
  } else {
    // Each selected tier is paid either by one area or split across all three.
    const mode = pick(['cash', 'rows', 'mixed']);
    const cash = mode === 'cash' ? amount : mode === 'mixed' && amount >= 100 ? amount - 60 : 0;
    const thumb = mode !== 'cash' && amount >= 60 && (mode === 'mixed' || amount === 60);
    const remainder = amount - cash - (thumb ? 60 : 0);
    add('玩法一 · 即开即得', 'cash', '惊喜奖金', [cash ? `¥${cash.toLocaleString()}` : '谢谢参与'], cash);
    const rowAmounts = remainder ? (remainder % 40 === 0 ? [remainder / 2, remainder / 2] : [remainder]) : [];
    const rowAwards = new Map(rowAmounts.map((value, i) => [order[i], value]));
    const symbols = ['元宝', '铜钱', '灯笼', '如意', '福袋'];
    for (let i = 0; i < 6; i++) {
      const award = rowAwards.get(i) ?? 0;
      const multiplier = award > 0 && award % 6 === 0 && random() < 0.5;
      const symbol = pick(symbols);
      const values = award ? (multiplier ? [symbol, '6', pick(symbols)] : [symbol, symbol, symbol]) : ['元宝', '铜钱', '灯笼'];
      add('玩法二 · 六局翻倍', 'triple', `第 ${i + 1} 局`, values, award ? award / (multiplier ? 6 : 1) : pick([20, 30, 50, 100]));
    }
    add('玩法三 · 点赞有礼', 'thumb', '点赞有礼', [thumb ? '赞' : '花']);
  }
  return { game, winning, zones };
}
