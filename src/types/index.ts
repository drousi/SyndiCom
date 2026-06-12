// ─── Notification ───────────────────────────────────────────────────────────────

export type NotificationType = 'reminder' | 'payment' | 'payment_declaration' | 'expense' | 'system';

export interface AppNotification {
  id: string;
  residence_id: string;
  title: string;
  body: string;
  type: NotificationType;
  is_read: boolean;
  is_archived: boolean;
  target_user_id: string | null;
  related_declaration_id: string | null;
  metadata: Record<string, any> | null;
  created_at: string;
}

// ─── Roles ─────────────────────────────────────────────────────────────────────

/** Rôle système (app-level) — stocké dans profiles.system_role */
export type SystemRole = 'superuser' | 'user';

/** Rôle par résidence — stocké dans user_residences.role */
export type ResidenceRole = 'admin' | 'manager' | 'resident';

// ─── Profile ────────────────────────────────────────────────────────────────────

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  push_token: string | null;
  system_role: SystemRole;
  force_password_change: boolean;
  created_at: string;
  updated_at: string;
}

/** Profil enrichi avec le rôle de la résidence active */
export interface UserWithRole extends Profile {
  residence_role: ResidenceRole | null;
  active_residence_id: string | null;
}

// ─── Residence ─────────────────────────────────────────────────────────────────

export interface Residence {
  id: string;
  name: string;
  address: string | null;
  currency: string;
  apartment_count: number;
  monthly_fee: number;
  contribution_frequency: 'monthly' | 'quarterly' | 'yearly';
  // Reminder settings (stored per-residence in Supabase)
  reminder_enabled: boolean;
  reminder_day: number;    // 1=Sun, 2=Mon, 3=Tue, 4=Wed, 5=Thu, 6=Fri, 7=Sat
  reminder_hour: number;
  reminder_minute: number;
  created_at: string;
  updated_at: string;
}

/** Résidence avec le rôle de l'utilisateur courant */
export interface ResidenceWithRole extends Residence {
  role: ResidenceRole;
}

// ─── Apartment ─────────────────────────────────────────────────────────────────

export interface Apartment {
  id: string;
  residence_id: string;
  number: string;
  floor: number | null;
  owner_name: string | null;
  phone: string | null;
  email: string | null;
  whatsapp: string | null;
  resident_user_id: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

// ─── Contribution ──────────────────────────────────────────────────────────────

export interface Contribution {
  id: string;
  residence_id: string;
  apartment_id: string;
  month: number; // 1–12 depending on frequency
  year: number;
  amount: number;
  paid: boolean;
  paid_at: string | null;
  comment: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContributionWithApartment extends Contribution {
  apartment_number: string;
  apartment_owner: string | null;
}

// ─── Payment Declaration ────────────────────────────────────────────────────────

export type DeclarationStatus = 'pending' | 'validated' | 'rejected';

export interface PaymentDeclaration {
  id: string;
  residence_id: string;
  apartment_id: string;
  declared_by: string;
  amount: number;
  note: string | null;
  status: DeclarationStatus;
  validated_by: string | null;
  validated_at: string | null;
  created_at: string;
}

export interface PaymentDeclarationWithApartment extends PaymentDeclaration {
  apartment_number: string;
  owner_name: string | null;
  declarer_name: string | null;
}

// ─── Expense Templates ────────────────────────────────────────────────────────

export interface ExpenseTemplate {
  id: string;
  residence_id: string;
  title: string;
  type: string;
  amount_type: 'fixed' | 'variable';
  default_amount: number;
  active: boolean;
  periodicity: 'monthly' | 'quarterly' | 'yearly';
  recurrence_day: number;
  recurrence_month: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Expense ───────────────────────────────────────────────────────────────────

export interface Expense {
  id: string;
  residence_id: string;
  template_id: string | null;
  date: string;
  type: string;
  description: string | null;
  amount: number;
  status: 'paid' | 'pending_amount' | 'pending_payment';
  receipt_url: string | null;
  deleted: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// ─── User Residence ────────────────────────────────────────────────────────────

export interface UserResidence {
  user_id: string;
  residence_id: string;
  role: ResidenceRole;
  created_at: string;
  updated_at: string;
}

export interface UserResidenceWithProfile extends UserResidence {
  full_name: string | null;
  email: string;
  phone: string | null;
}

// ─── Dashboard ─────────────────────────────────────────────────────────────────

export interface DashboardStats {
  balance: number;
  totalContributions: number;
  totalExpenses: number;
  monthlyContributions: number;
  monthlyExpenses: number;
  paidApartments: number;
  totalApartments: number;
  unpaidCount: number;
  paidPercent: number;
}

export interface RecentOperation {
  id: string;
  type: 'contribution' | 'expense';
  expenseType?: string;
  label: string;
  sublabel: string;
  amount: number;
  date: string;
}

// ─── Superuser Dashboard ───────────────────────────────────────────────────────

export interface SyndicSummary {
  residence: Residence;
  apartment_count: number;
  admin_email: string | null;
  manager_email: string | null;
  total_contributions: number;
  total_expenses: number;
}

// ─── Permissions ───────────────────────────────────────────────────────────────

export type PermissionAction =
  | 'read'
  | 'write'
  | 'delete'
  | 'manageUsers'
  | 'manageResidence'
  | 'declarePayment';
