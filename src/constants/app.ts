export const EXPENSE_TYPES = [
  { key: 'eau', label: 'Eau', icon: 'water-outline' },
  { key: 'electricite', label: 'Électricité', icon: 'flash-outline' },
  { key: 'menage', label: 'Ménage', icon: 'brush-outline' },
  { key: 'produits_menage', label: 'Produits Ménage', icon: 'cart-outline' },
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

import { useLanguageStore } from '../store/language.store';

export function getFrequencies() {
  const t = useLanguageStore.getState().t;
  return [
    { key: 'monthly' as const, label: t('frequencies.monthly') },
    { key: 'quarterly' as const, label: t('frequencies.quarterly') },
    { key: 'yearly' as const, label: t('frequencies.yearly') },
  ];
}

export function getPeriodLabels(frequency: 'monthly' | 'quarterly' | 'yearly'): string[] {
  const t = useLanguageStore.getState().t;
  switch (frequency) {
    case 'quarterly':
      return [
        t('periods.q1'),
        t('periods.q2'),
        t('periods.q3'),
        t('periods.q4')
      ];
    case 'yearly':
      return [t('periods.yearly')];
    case 'monthly':
    default:
      return [
        t('periods.m1'), t('periods.m2'), t('periods.m3'), t('periods.m4'),
        t('periods.m5'), t('periods.m6'), t('periods.m7'), t('periods.m8'),
        t('periods.m9'), t('periods.m10'), t('periods.m11'), t('periods.m12')
      ];
  }
}

export function getPeriodShortLabels(frequency: 'monthly' | 'quarterly' | 'yearly'): string[] {
  const t = useLanguageStore.getState().t;
  switch (frequency) {
    case 'quarterly':
      return [
        t('periods.q1_short'),
        t('periods.q2_short'),
        t('periods.q3_short'),
        t('periods.q4_short')
      ];
    case 'yearly':
      return [t('periods.yearly_short')];
    case 'monthly':
    default:
      return [
        t('periods.m1_short'), t('periods.m2_short'), t('periods.m3_short'), t('periods.m4_short'),
        t('periods.m5_short'), t('periods.m6_short'), t('periods.m7_short'), t('periods.m8_short'),
        t('periods.m9_short'), t('periods.m10_short'), t('periods.m11_short'), t('periods.m12_short')
      ];
  }
}
