import { ITEM_QUESTIONS } from './item-questions';
import type { Question, QuestionOption, QuizRoute } from './types';

/** Display wording mirrors the public Pokopia catalogue's preference labels. */
export const FAVORITE_LABELS: Record<string, string> = {
  '自然': '能感受大自然的', '水': '能感受水的', '火': '能感受火的', '大地': '能感受土的',
  '风': '能感受风的', '海': '能感受海的', '疗愈': '能治愈伤口的', '柔软': '柔软的',
  '可爱': '可爱的', '闪亮': '闪亮亮的', '花朵': '花朵绽放的', '缤纷': '色彩缤纷的',
  '圆润': '圆滚滚的', '旋转': '会旋转的', '摇摆': '会摇晃的', '观赏': '观赏用的',
  '文字': '有文字的', '玻璃': '有玻璃的', '金属': '金属的', '坚硬': '坚硬的',
  '细长': '细长的', '尖尖': '尖尖的', '诡异': '诡异的', '奇妙': '奇妙的',
  '石制': '石制的', '木制': '木制的', '布艺': '布制的', '方方': '方方的',
  '机械': '以电力驱动的', '热闹': '集聚在一起的', '共享': '大家一起用的', '整洁': '整洁的',
  '垃圾': '垃圾', '建设': '建设', '容器': '容器', '运动': '训练用的', '美食': '像食物的',
  '豪华': '豪华的', '玩乐': '游戏区', '交通工具': '交通工具', '象征': '象征',
  '知识': '艰深难懂的', '音乐': '会发出声响的',
};

export const FLAVOR_LABELS: Record<string, string> = {
  '甜': '甜甜的', '酸': '酸酸的', '辣': '辣辣的', '苦': '苦苦的', '涩': '涩涩的',
};

export const ENVIRONMENT_LABELS: Record<string, string> = {
  '明亮': '明亮', '湿润': '湿润', '温暖': '温暖', '干燥': '干燥', '昏暗': '昏暗', '凉爽': '凉爽',
};

export const SPECIALTY_LABELS: Record<string, string> = {
  '栽培': '栽培', '滋润': '滋润', '点火': '点火', '伐木': '伐木', '建造': '建造', '工匠': '工匠',
  '碾压': '碾压', '重踏': '重踏', '找东西': '找东西', '收纳': '收纳', '收藏家': '收藏家',
  '回收利用': '回收利用', '擦亮': '擦亮', '交易': '交易', '带动气氛': '带动气氛', 'DJ': 'DJ',
  '采蜜': '采蜜', '发电': '发电', '发光': '发光', '彩绘': '彩绘', '开派对': '开派对',
  '鉴定': '鉴定', '瞬间移动': '瞬间移动', '变身': '变身', '爆炸': '爆炸', '飞翔': '飞翔',
  '贪吃鬼': '贪吃鬼', '稀有化': '稀有化', '梦岛': '梦岛', '哈欠': '哈欠', '乱撒': '乱撒',
};

export const ROUTE_LABELS: Record<QuizRoute, string> = {
  creative: '创作与收藏',
  craft: '手作与建造',
  explore: '出门探索',
  food: '食物与招待',
  home: '安家与休息',
  nature: '自然与栽培',
  social: '邻居与热闹',
};

const CORE_QUESTIONS = ITEM_QUESTIONS.filter((question) => question.phase !== 'branch');
const BRANCH_QUESTIONS = ITEM_QUESTIONS.filter((question) => question.phase === 'branch');
const BRANCH_QUESTION_LIMIT = 6;

function stableQuestionOrder(question: Question, signature: string): number {
  let hash = 2166136261;
  for (const character of `${signature}:${question.id}`) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function selectVariedBranchQuestions(
  questions: Question[],
  signature: string,
): Question[] {
  const remaining = [...questions];
  const selected: Question[] = [];
  const seenOptionIds = new Set<string>();

  while (remaining.length > 0 && selected.length < BRANCH_QUESTION_LIMIT) {
    remaining.sort((left, right) => {
      const specificity = (left.requiresAnyRoute?.length ?? 0) - (right.requiresAnyRoute?.length ?? 0);
      if (specificity) return specificity;

      const freshOptions = (question: Question) => question.options.filter(
        (option) => !option.id.endsWith('-other') && !seenOptionIds.has(option.id),
      ).length;
      const freshness = freshOptions(right) - freshOptions(left);
      return freshness || stableQuestionOrder(left, signature) - stableQuestionOrder(right, signature);
    });

    const question = remaining.shift();
    if (!question) break;
    question.options
      .filter((option) => !option.id.endsWith('-other'))
      .forEach((option) => seenOptionIds.add(option.id));
    selected.push(question);
  }

  return selected;
}

export type QuizAnswers = Record<string, QuestionOption[]>;

export function selectedRoutes(answers: QuizAnswers): QuizRoute[] {
  return [...new Set(
    Object.values(answers)
      .flat()
      .flatMap((option) => option.routeTags ?? []),
  )];
}

/**
 * Everyone answers the same preference baseline first. Later item groups only
 * appear when the "今日待办" choice makes that group meaningful.
 */
export function questionsForAnswers(answers: QuizAnswers): Question[] {
  const routes = new Set(selectedRoutes(answers));
  const coreIds = new Set(CORE_QUESTIONS.map((question) => question.id));
  const signature = Object.entries(answers)
    .filter(([questionId]) => coreIds.has(questionId))
    .flatMap(([questionId, options]) => options.map((option) => `${questionId}:${option.id}`))
    .sort()
    .join('|');
  const eligibleBranchQuestions = BRANCH_QUESTIONS.filter((question) =>
    question.requiresAnyRoute?.some((route) => routes.has(route)),
  );
  return [
    ...CORE_QUESTIONS,
    ...selectVariedBranchQuestions(eligibleBranchQuestions, signature),
  ];
}

export const QUESTIONS = questionsForAnswers({});

export const GROUP_LABELS = {
  base: '主图鉴', basin: '海底图鉴', event: '活动图鉴', unique: '传说 / 幻之',
} as const;
