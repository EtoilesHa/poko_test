export type Flavor = '甜' | '辣' | '酸' | '苦' | '涩';

export type Environment = '明亮' | '湿润' | '温暖' | '干燥' | '昏暗' | '凉爽';

export type PokemonGroup = 'base' | 'basin' | 'event' | 'unique';

export type Pokemon = {
  id: string;
  dexNo: number;
  name: string;
  group: PokemonGroup;
  types: string[];
  specialties: string[];
  environment: Environment | null;
  favorites: string[];
  flavor: Flavor | null;
  tagline: string;
  shareLine: string;
};

export type AnswerWeights = {
  favorites?: Record<string, number>;
  flavors?: Partial<Record<Flavor, number>>;
  environments?: Partial<Record<Environment, number>>;
  specialties?: Record<string, number>;
};

export type QuestionOption = AnswerWeights & {
  id: string;
  title: string;
  description?: string;
  emoji?: string;
  image?: string;
  imageAlt?: string;
  sceneItems?: Array<{
    image: string;
    imageAlt: string;
    title: string;
  }>;
};

export type Question = {
  id: string;
  eyebrow: string;
  prompt: string;
  hint: string;
  minSelections: number;
  maxSelections: number;
  presentation: 'items';
  options: QuestionOption[];
};

export type ScoreBreakdown = {
  total: number;
  favorites: number;
  flavor: number;
  environment: number;
  specialty: number;
  matchedFavorites: string[];
  matchedFlavor: string | null;
  matchedEnvironment: string | null;
  matchedSpecialties: string[];
};

export type RankedPokemon = Pokemon & {
  score: ScoreBreakdown;
};
