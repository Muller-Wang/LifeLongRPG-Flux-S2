import type { HeroId } from './client/storage';

export interface Hero {
  id: HeroId;
  name: string;
  rarity: 'N' | 'R' | 'SR' | 'SSR';
  rarityColor: string;
  tagline: string;
  story: string;
  talents: string[];
  glyph: string;
  accent: string;
}

export const HEROES: Hero[] = [
  {
    id: 'student',
    name: '大学生',
    rarity: 'N',
    rarityColor: '#5A8F6E',
    tagline: '表面是"祖国未来栋梁"，实际是"早八陪睡员"与"花呗重度依赖者"的混合体。',
    story:
      '你的核心技能是《如何在考前 24 小时创造一门全新的学科》。口头禅是"明天一定早睡"，然后眼睁睁刷短视频，刷到天花板泛起鱼肚白。',
    talents: ['考前 24h 学科创造 +∞', '早睡 Flag -100%', '花呗依赖 +85%'],
    glyph: '学',
    accent: '#5A8F6E'
  },
  {
    id: 'corporate',
    name: '社畜',
    rarity: 'N',
    rarityColor: '#FFBC42',
    tagline: '全名"社会畜生"。靠咖啡吊命，用"收到"续命的都市 NPC。',
    story:
      '你的超能力是每次在群里秒回"好的，麻烦了～"，同时在心里把甲方和老板的祖宗十八代问候了个遍。',
    talents: ['秒回话术 +90%', '心理诅咒 +200%', '真实疲惫 +∞'],
    glyph: '社',
    accent: '#FFBC42'
  },
  {
    id: 'rich',
    name: '富哥',
    rarity: 'SSR',
    rarityColor: '#D17642',
    tagline: '游戏人间 VIP 体验卡持有者，被动技能是"钞能力"。',
    story:
      '别人在游戏里肝到秃头，你在游戏里氪到策划叫你爹。最大的烦恼是"银行卡里的利息该怎么花"，以及"今天开哪辆跑车才能在朋友圈显得低调又有内涵"。',
    talents: ['钞能力 +∞', '共情值 -40%', '低调内涵选车困难 ±???'],
    glyph: '富',
    accent: '#D17642'
  },
  {
    id: 'neet',
    name: '家里蹲',
    rarity: 'N',
    rarityColor: '#7C6FB0',
    tagline: '与外界保持着"非必要不接触"的星际外交原则。',
    story:
      '外卖小哥是唯一的星际访客。你正在攻克一项人类难题：《论如何在手办和游戏皮肤之间平衡财政赤字》。',
    talents: ['社交 -∞', '外卖识别精度 +99%', '财政赤字 ±???'],
    glyph: '蹲',
    accent: '#7C6FB0'
  },
  {
    id: 'retiree',
    name: '退休大爷',
    rarity: 'R',
    rarityColor: '#5A6A7E',
    tagline: '公交车上的隐藏战神，公园单杠上的杂技演员。',
    story:
      '超市鸡蛋打折时的短跑健将。一个什么都不怕的人是很危险的——他花了六十年才变成这种危险。',
    talents: ['单杠杂技 +60', '抢蛋速度 +200%', '怕的东西 -∞'],
    glyph: '叟',
    accent: '#5A6A7E'
  },
  {
    id: 'freelancer',
    name: '自由职业者',
    rarity: 'R',
    rarityColor: '#94B0DA',
    tagline: '你成功逃离了老板，却不幸落入上百个甲方的混合双打。',
    story:
      '简历上的"时间自由"，这不算假话。只是不算全部的真话——翻译过来就是"凌晨三点被喊起来改稿的被动技能"。',
    talents: ['时间自由 ±50%', '凌晨改稿 +∞', '老板已逃 ✓'],
    glyph: '由',
    accent: '#94B0DA'
  },
  {
    id: 'researcher',
    name: '科研人员',
    rarity: 'SR',
    rarityColor: '#084B83',
    tagline: '实验室常驻 NPC。发量是学位的反向指标。',
    story:
      '主职是伺候小鼠、弄坏仪器和拉高导师的血压。精神状态完全取决于今天的 P 值是否小于 0.05。夜深人静时，你总会盯着失败的实验数据陷入哲学三问：我是谁？我当初为什么要读博？这个数据稍微编一编应该没人能看出来吧？',
    talents: ['发量 -50%', 'P 值依赖 +∞', '哲学三问 ✓'],
    glyph: '研',
    accent: '#084B83'
  }
];

export function getHero(id: string): Hero | undefined {
  return HEROES.find(h => h.id === id);
}
