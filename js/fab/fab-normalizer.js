export function normalizeTeamName(name) {
  return String(name ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\b(CD|CB|AD|C|CLUB)\b/g, '')
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();
}

export function sameTeam(a, b) {
  return normalizeTeamName(a) === normalizeTeamName(b);
}

export function matchBelongsToTeam(match, aliases) {
  const allowed = aliases.map(normalizeTeamName);
  return allowed.includes(normalizeTeamName(match.homeTeam)) || allowed.includes(normalizeTeamName(match.awayTeam));
}
