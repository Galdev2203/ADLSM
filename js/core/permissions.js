export const ROLES = Object.freeze({
  COORDINADOR: 'Coordinador',
  RESPONSABLE: 'Responsable',
  ENTRENADOR: 'Entrenador',
  CONSULTA: 'Consulta'
});

export function hasRole(context, role) {
  return Boolean(context?.roles?.includes(role));
}

export function canManageEverything(context) {
  return hasRole(context, ROLES.COORDINADOR);
}

export function canManageSection(context) {
  return hasRole(context, ROLES.COORDINADOR) || hasRole(context, ROLES.RESPONSABLE);
}

export function canManageTeam(context) {
  return hasRole(context, ROLES.COORDINADOR) || hasRole(context, ROLES.RESPONSABLE) || hasRole(context, ROLES.ENTRENADOR);
}
