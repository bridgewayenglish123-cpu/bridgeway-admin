// Bridgeway Admin: 資料庫型別定義
// 之後可用 supabase CLI 自動生成:
// npx supabase gen types typescript --project-id ssjdgeuhnoeqmaarsgsw > src/lib/supabase/database.types.ts

export type TeacherType = "Hanne" | "Other";
export type ActiveStatus = "Active" | "Inactive";
export type StudentStatus = "Active" | "Paused" | "Closed";
export type BillingType = "Trial" | "Single" | "Package";
export type CourseFamily = "General" | "Trial";
export type DurationType = "Short25" | "Long55" | "Trial25";
export type LessonStatus = "scheduled" | "completed" | "cancelled";
export type ClassType = "general" | "makeup" | "extension";

export interface PayoutSnapshot {
  original_price_ntd: number;
  lesson_count: number;
  teacher_payout_ntd: number;
  hanne_share_ntd: number;
  lee_commission_ntd: number;
}

export interface Teacher {
  id: string;
  teacher_code: string;
  teacher_name: string;
  teacher_type: TeacherType;
  active_status: ActiveStatus;
  email: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Student {
  id: string;
  zh_name: string;
  en_name: string | null;
  zoom_email: string | null;
  contact_info: string | null;
  age: string | null;
  status: StudentStatus;
  current_teacher_id: string | null;
  auth_user_id: string | null;
  learning_goal: string | null;
  created_at: string;
  updated_at: string;
}

export interface PriceRule {
  id: string;
  price_rule_code: string;
  display_name: string;
  teacher_type: TeacherType;
  course_family: string;
  duration_type: string;
  billing_type: BillingType;
  lesson_count: number;
  price_ntd: number;
  teacher_payout_ntd: number;
  hanne_share_ntd: number;
  validity_days: number | null;
  active_status: ActiveStatus;
  created_at: string;
  updated_at: string;
}

export interface Enrollment {
  id: string;
  student_id: string;
  price_rule_code: string | null;
  payment_date: string;
  note: string | null;
  snapshot: PayoutSnapshot;
  created_at: string;
  updated_at: string;
}

export interface Account {
  id: string;
  enrollment_id: string;
  student_id: string;
  course_label: string;
  teacher_type: TeacherType;
  course_family: string;
  duration_type: string;
  billing_type: BillingType;
  total_lessons: number;
  is_trial: boolean;
  start_lesson_date: string | null;
  valid_until: string | null;
  snapshot: PayoutSnapshot;
  status_override: "Closed" | null;
  created_at: string;
  updated_at: string;
}

export interface ScheduleRule {
  id: string;
  account_id: string;
  teacher_id: string | null;
  weekdays: number[];
  time: string;
  duration: number;
  start_date: string | null;
  end_date: string | null;
  active_status: ActiveStatus;
  batch_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Lesson {
  id: string;
  account_id: string;
  student_id: string;
  teacher_id: string | null;
  schedule_rule_id: string | null;
  date: string;
  time: string;
  duration: number;
  class_type: ClassType;
  status: LessonStatus;
  is_active: boolean;
  is_backfill: boolean;
  original_class_id: string | null;
  original_payout_snapshot: PayoutSnapshot | null;
  is_substitute: boolean;
  original_teacher_id: string | null;
  payout_snapshot: PayoutSnapshot;
  note: string | null;
  superseded: boolean;
  created_at: string;
  updated_at: string;
}

export interface RemittancePeriod {
  period_key: string;
  paid: boolean;
  paid_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface RemittanceExtra {
  id: string;
  period_key: string;
  teacher_id: string | null;
  amount_php: number;
  amount_ntd: number;
  note: string | null;
  date: string;
  created_at: string;
}

export interface AppMeta {
  id: number;
  php_rate: number;
  last_backup_at: string | null;
  seed_version: number | null;
  student_seed_version: number | null;
  updated_at: string;
}
