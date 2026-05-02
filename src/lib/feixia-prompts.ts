/**
 * 绯夏在前端关键节点使用的「即时引导提示词」
 *
 * 这些是注入到 chat API 的 user message 模板。
 * 后端的 system prompt（人设 + 阶段约束）保持不变，
 * 这里只是给绯夏一个「上下文框架」让她知道当下场景。
 *
 * 设计原则：
 * - 不在前端硬编码绯夏会"说什么"——交给 LLM
 * - 但要给她足够的"场景信号"，让她不跑偏
 *
 * 留白：未来可以根据用户反馈继续调整这些提示词模板。
 */

/**
 * 用户刚选完职业第一次见到绯夏时使用。
 * 期望输出：极简、克制、不自我介绍、把"开始"主动权交给用户。
 */
export function promptForOnboardingIntro(heroName: string): string {
  return `（系统：用户作为「${heroName}」职业刚选完角色，第一次见到你。请说一句话——不要自我介绍，不要客套，不要欢迎，把"接下来做什么"的主动权留给他。）`;
}

/**
 * 进入主线录入界面时使用：引导用户认真思考主线该写什么。
 * TODO: 这是引导用户设定主线的提示词，可根据产品迭代继续优化。
 *       当前是占位版本，未来可以根据复盘数据调整语气和长度。
 */
export function promptForMainQuestGuide(heroName: string): string {
  return `（系统：用户即将设定他的人生主线任务。我们不给他模板，因为主线是他自己的。请用一句话引导他——可以是反问、可以是观察、可以挑战他敷衍。但不要客套，不要鸡汤，不要"加油"。让他认真想想为什么是现在、为什么是这件事。）`;
}

/**
 * 用户提交主线后使用：让绯夏即时回应他写的主线，制造陪伴感。
 */
export function promptForMainQuestReact(
  heroName: string,
  mainTitles: string[]
): string {
  const list = mainTitles.map(t => `「${t}」`).join('、');
  return `（系统：用户作为「${heroName}」刚提交了他的主线任务：${list}。请用一句话即时回应——可以是反问、观察、挑剔、或简短地"接住"。绝不夸奖，绝不总结，绝不说"加油"。让他感受到你看见了他写的具体内容。）`;
}

/**
 * 用户完成支线设定，准备进入主页前使用。
 * 期望输出：克制、不庆祝，标记一个"开始"的瞬间。
 */
export function promptForOnboardingComplete(): string {
  return `（系统：用户刚完成全部任务初始化设定，正要进入主界面。请用一句话标记这个开始的瞬间——不要庆祝，不要鼓励，简短克制即可。）`;
}
