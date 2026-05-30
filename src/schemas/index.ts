import { z } from 'zod';

export const residenceSchema = z.object({
  name: z.string().min(2, 'Le nom doit contenir au moins 2 caractères'),
  address: z.string().optional(),
  currency: z.string().default('DH'),
  monthly_fee: z.number({ invalid_type_error: 'Montant invalide' }).min(0, 'Le montant doit être positif'),
});

export type ResidenceFormData = z.infer<typeof residenceSchema>;

export const apartmentSchema = z.object({
  number: z.string().min(1, 'Le numéro est requis'),
  floor: z.number().optional().nullable(),
  owner_name: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('Email invalide').optional().or(z.literal('')),
  whatsapp: z.string().optional(),
  active: z.boolean().default(true),
});

export type ApartmentFormData = z.infer<typeof apartmentSchema>;

export const expenseSchema = z.object({
  date: z.string().min(1, 'La date est requise'),
  type: z.string().min(1, 'Le type est requis'),
  description: z.string().optional(),
  amount: z.number({ invalid_type_error: 'Montant invalide' }).min(0.01, 'Le montant doit être supérieur à 0'),
});

export type ExpenseFormData = z.infer<typeof expenseSchema>;

export const contributionSchema = z.object({
  amount: z.number({ invalid_type_error: 'Montant invalide' }).min(0, 'Montant invalide'),
  comment: z.string().optional(),
  paid: z.boolean().default(false),
});

export type ContributionFormData = z.infer<typeof contributionSchema>;

export const loginSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(6, 'Mot de passe trop court'),
});

export type LoginFormData = z.infer<typeof loginSchema>;

export const resetPasswordSchema = z.object({
  email: z.string().email('Email invalide'),
});

export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;
