export const EXPENSE_TYPES = [
  { key: 'eau', label: 'Eau', icon: 'water-outline' },
  { key: 'electricite', label: 'Électricité', icon: 'flash-outline' },
  { key: 'menage', label: 'Ménage', icon: 'brush-outline' },
  { key: 'gardien', label: 'Gardien', icon: 'shield-outline' },
  { key: 'reparation', label: 'Réparation', icon: 'construct-outline' },
  { key: 'ascenseur', label: 'Ascenseur', icon: 'arrow-up-outline' },
  { key: 'divers', label: 'Divers', icon: 'ellipsis-horizontal-outline' },
] as const;

export type ExpenseTypeKey = typeof EXPENSE_TYPES[number]['key'];

export const MONTHS_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

export const MONTHS_SHORT_FR = [
  'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun',
  'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc',
];

export const CURRENCIES = [
  { code: 'DH', label: 'Dirham marocain (DH)' },
  { code: 'EUR', label: 'Euro (€)' },
  { code: 'USD', label: 'Dollar américain ($)' },
  { code: 'GBP', label: 'Livre sterling (£)' },
];

export const ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  RESIDENT: 'resident',
} as const;

export const ROLE_LABELS: Record<string, string> = {
  superuser: 'Super Admin',
  admin: 'Administrateur',
  manager: 'Gérant',
  resident: 'Résident',
  user: 'Utilisateur',
};
