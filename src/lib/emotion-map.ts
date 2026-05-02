/**
 * 绯夏情绪标签 → 表情包图片映射
 *
 * 设计原则：
 * - LLM 在回复末尾输出 [emotion:xxx] 格式标签
 * - 后端解析标签，从文本中移除，只把干净文本返回前端
 * - 前端根据 emotion 字段加载 public/emojis/ 下对应图片
 * - 如果标签无效或未提供，fallback 到 default（不显示表情包）
 */

export const EMOJI_BASE_PATH = '/emojis';

/** 有效情绪标签 → 图片文件名（不含扩展名） */
export const EMOTION_TO_EMOJI: Record<string, string> = {
  // 核心情绪
  shy: 'shy',
  angry: 'anger',
  anger: 'anger',
  confused: 'confused',
  sleepy: 'fall-asleep',
  tired: 'fall-asleep',
  bored: 'fall-asleep',
  happy: 'jump-for-joy',
  joy: 'jump-for-joy',
  excited: 'jump-for-joy',
  love: 'finger-heart',
  heart: 'finger-heart',
  affection: 'finger-heart',
  hug: 'give-me-a-hug',
  warm: 'give-me-a-hug',
  thumbup: 'give-you-a-thumb-up',
  praise: 'give-you-a-thumb-up',
  approve: 'give-you-a-thumb-up',
  good: 'give-you-a-thumb-up',
  greeting: 'hello',
  hello: 'hello',
  recognize: 'its-you',
  notice: 'its-you',
  clap: 'clap-the-hands',
  applause: 'clap-the-hands',
  celebrate: 'clap-the-hands',
  cheek: 'cheek-to-cheek',
  blush: 'cheek-to-cheek',
  embarrassed: 'cheek-to-cheek',
  please: 'please',
  beg: 'please',
  request: 'please',
  poke: 'poke-you',
  tease: 'poke-you',
  proud: 'proud',
  received: 'received',
  ok: 'received',
  understood: 'received',
  rewarded: 'rewarded',
  treasure: 'rewarded',
  sad: 'sadly',
  sadly: 'sadly',
  disappointed: 'sadly',
  flowers: 'send-flowers',
  gift: 'send-flowers',
  grateful: 'send-flowers',
  shock: 'shock',
  surprised: 'shock',
  amazed: 'shock',
  speechless: 'speechless',
  silence: 'speechless',
  thanks: 'thank-you',
  thankyou: 'thank-you',
  gratitude: 'thank-you',
};

/** 情绪标签解析正则 */
const EMOTION_REGEX = /\[emotion:([a-z\-]+)\]\s*$/i;

/**
 * 从 LLM 原始回复中解析情绪标签
 * @returns { cleanText: 去掉标签后的纯文本, emotion: 标签值或 null }
 */
export function parseEmotion(raw: string): {
  cleanText: string;
  emotion: string | null;
} {
  const trimmed = raw.trim();
  const match = trimmed.match(EMOTION_REGEX);
  if (!match) {
    return { cleanText: trimmed, emotion: null };
  }
  const tag = match[1].toLowerCase();
  const cleanText = trimmed.slice(0, match.index).trim();
  // 绯夏只有 50% 的概率发表情包
  const shouldShowEmoji = Math.random() < 0.5;
  return { cleanText, emotion: shouldShowEmoji ? tag : null };
}

/**
 * 根据情绪标签获取表情包图片 URL
 * @returns 完整 URL 或 null（标签无效时）
 */
export function getEmojiUrl(emotion: string | null): string | null {
  if (!emotion) return null;
  const filename = EMOTION_TO_EMOJI[emotion.toLowerCase()];
  if (!filename) return null;
  return `${EMOJI_BASE_PATH}/${filename}.png`;
}

/**
 * 拼接进 system prompt 的「情绪标签指令」
 */
export function getEmotionInstruction(): string {
  const validTags = Object.keys(EMOTION_TO_EMOJI);
  // 去重后取唯一值
  const unique = Array.from(new Set(validTags));
  const tagList = unique.slice(0, 15).join(' / ');
  return `
【情绪标签】
你每次回复的末尾，必须附加一个情绪标签，格式为：[emotion:标签名]
标签代表你这句话的情绪状态，从以下列表中选择最贴切的一个：
${tagList} 等。
示例：「……知道了。[emotion:shy]」
注意：标签必须放在整段话的最后，不要换行。`;
}
