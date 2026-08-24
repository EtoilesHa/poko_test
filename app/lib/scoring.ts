import {
  ENVIRONMENT_LABELS,
  FAVORITE_LABELS,
  FLAVOR_LABELS,
  SPECIALTY_LABELS,
} from '../data/content';
import type {
  AnswerWeights,
  Pokemon,
  RankedPokemon,
  ScoreBreakdown,
} from '../data/types';

type UserProfile = {
  favorites: Record<string, number>;
  flavors: Record<string, number>;
  environments: Record<string, number>;
  specialties: Record<string, number>;
};

const createProfile = (): UserProfile => ({
  favorites: {},
  flavors: {},
  environments: {},
  specialties: {},
});

const mergeWeights = (
  target: Record<string, number>,
  source: Record<string, number> | undefined,
) => {
  Object.entries(source ?? {}).forEach(([key, value]) => {
    target[key] = (target[key] ?? 0) + value;
  });
};

export function makeProfile(answers: AnswerWeights[]): UserProfile {
  return answers.reduce<UserProfile>((profile, answer) => {
    mergeWeights(profile.favorites, answer.favorites);
    mergeWeights(profile.flavors, answer.flavors);
    mergeWeights(profile.environments, answer.environments);
    mergeWeights(profile.specialties, answer.specialties);
    return profile;
  }, createProfile());
}

type RarityMaps = {
  favorites: Record<string, number>;
  flavors: Record<string, number>;
  environments: Record<string, number>;
  specialties: Record<string, number>;
};

const SCORE_WEIGHTS = {
  favorites: 52,
  flavors: 10,
  environments: 12,
  specialties: 26,
} as const;

function countLabels(labelLists: string[][]): Record<string, number> {
  return labelLists.reduce<Record<string, number>>((counts, labels) => {
    new Set(labels).forEach((label) => {
      counts[label] = (counts[label] ?? 0) + 1;
    });
    return counts;
  }, {});
}

function buildRarityMaps(pokemon: Pokemon[]): RarityMaps {
  return {
    favorites: countLabels(pokemon.map((entry) => entry.favorites)),
    flavors: countLabels(pokemon.map((entry) => entry.flavor ? [entry.flavor] : [])),
    environments: countLabels(pokemon.map((entry) => entry.environment ? [entry.environment] : [])),
    specialties: countLabels(pokemon.map((entry) => entry.specialties)),
  };
}

function rarityWeight(count: number | undefined, total: number): number {
  const inverseFrequency = Math.log2((total + 1) / ((count ?? total) + 1));
  return 1 + Math.min(inverseFrequency, 2.5);
}

function weightedSimilarity(
  profile: Record<string, number>,
  candidateLabels: string[],
  frequencies: Record<string, number>,
  totalPokemon: number,
): number {
  const candidate = new Set(candidateLabels);
  let dotProduct = 0;
  let profileMagnitude = 0;
  let candidateMagnitude = 0;

  Object.entries(profile).forEach(([label, value]) => {
    const weight = rarityWeight(frequencies[label], totalPokemon);
    profileMagnitude += (value * value) * weight;
    if (candidate.has(label)) dotProduct += value * weight;
  });

  candidate.forEach((label) => {
    candidateMagnitude += rarityWeight(frequencies[label], totalPokemon);
  });

  if (profileMagnitude === 0 || candidateMagnitude === 0) return 0;
  return dotProduct / Math.sqrt(profileMagnitude * candidateMagnitude);
}

function scorePokemon(
  pokemon: Pokemon,
  profile: UserProfile,
  rarities: RarityMaps,
  totalPokemon: number,
): ScoreBreakdown {
  const favoriteSimilarity = weightedSimilarity(
    profile.favorites,
    pokemon.favorites,
    rarities.favorites,
    totalPokemon,
  );
  const flavorSimilarity = weightedSimilarity(
    profile.flavors,
    pokemon.flavor ? [pokemon.flavor] : [],
    rarities.flavors,
    totalPokemon,
  );
  const environmentSimilarity = weightedSimilarity(
    profile.environments,
    pokemon.environment ? [pokemon.environment] : [],
    rarities.environments,
    totalPokemon,
  );
  const specialtySimilarity = weightedSimilarity(
    profile.specialties,
    pokemon.specialties,
    rarities.specialties,
    totalPokemon,
  );

  const favorites = favoriteSimilarity * SCORE_WEIGHTS.favorites;
  const flavor = flavorSimilarity * SCORE_WEIGHTS.flavors;
  const environment = environmentSimilarity * SCORE_WEIGHTS.environments;
  const specialty = specialtySimilarity * SCORE_WEIGHTS.specialties;
  const rawTotal = favorites + flavor + environment + specialty;
  const flavorMatched = Boolean(pokemon.flavor && profile.flavors[pokemon.flavor]);
  const environmentMatched = Boolean(
    pokemon.environment && profile.environments[pokemon.environment],
  );

  return {
    total: Math.round(rawTotal),
    rawTotal,
    favorites: Math.round(favorites),
    flavor: Math.round(flavor),
    environment: Math.round(environment),
    specialty: Math.round(specialty),
    matchedFavorites: pokemon.favorites
      .filter((favorite) => profile.favorites[favorite])
      .sort((left, right) => profile.favorites[right] - profile.favorites[left])
      .slice(0, 3)
      .map((favorite) => FAVORITE_LABELS[favorite] ?? favorite),
    matchedFlavor: flavorMatched && pokemon.flavor
      ? (FLAVOR_LABELS[pokemon.flavor] ?? pokemon.flavor)
      : null,
    matchedEnvironment: environmentMatched && pokemon.environment
      ? (ENVIRONMENT_LABELS[pokemon.environment] ?? pokemon.environment)
      : null,
    matchedSpecialties: pokemon.specialties
      .filter((specialty) => profile.specialties[specialty])
      .sort((left, right) => profile.specialties[right] - profile.specialties[left])
      .slice(0, 2)
      .map((specialty) => SPECIALTY_LABELS[specialty] ?? specialty),
  };
}

export function rankPokemon(
  pokemon: Pokemon[],
  answers: AnswerWeights[],
): RankedPokemon[] {
  const profile = makeProfile(answers);
  const rarities = buildRarityMaps(pokemon);
  return pokemon
    .map((candidate) => ({
      ...candidate,
      score: scorePokemon(candidate, profile, rarities, pokemon.length),
    }))
    .sort((left, right) => {
      if (right.score.rawTotal !== left.score.rawTotal) {
        return right.score.rawTotal - left.score.rawTotal;
      }

      return left.dexNo - right.dexNo;
    });
}
