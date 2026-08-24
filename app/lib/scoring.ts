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

const ratio = (score: number, possible: number) =>
  possible <= 0 ? 0 : Math.min(score / possible, 1);

function scorePokemon(pokemon: Pokemon, profile: UserProfile): ScoreBreakdown {
  const favoritePossible = Object.values(profile.favorites).reduce(
    (sum, value) => sum + value,
    0,
  );
  const favoriteRaw = pokemon.favorites.reduce(
    (sum, favorite) => sum + (profile.favorites[favorite] ?? 0),
    0,
  );
  const favorites = ratio(favoriteRaw, favoritePossible) * 35;

  const flavorMatched = Boolean(pokemon.flavor && profile.flavors[pokemon.flavor]);
  const flavor = flavorMatched ? 20 : 0;
  const environmentMatched = Boolean(
    pokemon.environment && profile.environments[pokemon.environment],
  );
  const environment = environmentMatched ? 20 : 0;
  const specialtyRaw = pokemon.specialties.reduce(
    (sum, specialty) => sum + (profile.specialties[specialty] ?? 0),
    0,
  );
  const specialtyPossible = Object.values(profile.specialties).reduce(
    (sum, value) => sum + value,
    0,
  );
  const specialty = ratio(specialtyRaw, specialtyPossible) * 25;

  return {
    total: Math.round(favorites + flavor + environment + specialty),
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
  return pokemon
    .map((candidate) => ({ ...candidate, score: scorePokemon(candidate, profile) }))
    .sort((left, right) => {
      if (right.score.total !== left.score.total) {
        return right.score.total - left.score.total;
      }

      return left.dexNo - right.dexNo;
    });
}
