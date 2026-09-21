export function normalizeTeamName(name) {
  return String(name ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\b(CD|CB|AD|C|CLUB)\b/g, '')
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();
}

/**
 * Returns the club/family name behind a FAB team variant.
 * Example: LA SALLE MONTEMOLIN A/B/C/D -> LA SALLE MONTEMOLIN.
 * Only a final single letter A-D is treated as a team suffix.
 */
export function normalizeTeamFamily(name) {
  return normalizeTeamName(name).replace(/\s+[ABCD]$/, '').trim();
}

export function sameTeam(a, b) {
  return normalizeTeamName(a) === normalizeTeamName(b);
}

export function sameTeamFamily(a, b) {
  return normalizeTeamFamily(a) === normalizeTeamFamily(b);
}

export function matchBelongsToTeam(match, aliases) {
  const allowed = aliases.map(normalizeTeamName);
  return allowed.includes(normalizeTeamName(match.homeTeam)) || allowed.includes(normalizeTeamName(match.awayTeam));
}

export function matchBelongsToTeamFamily(match, family) {
  const normalizedFamily = normalizeTeamFamily(family);
  return normalizeTeamFamily(match.homeTeam) === normalizedFamily ||
    normalizeTeamFamily(match.awayTeam) === normalizedFamily;
}
