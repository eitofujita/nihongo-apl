export type Json = string | number | boolean | null | {[key: string]: Json | undefined} | Json[];
type Profile = {user_id: string; display_locale: 'en' | 'ru'; daily_goal_minutes: number; created_at: string};
export type Database = {
  public: {
    Tables: {
      profiles: {Row: Profile; Insert: Omit<Profile, 'created_at'>; Update: Partial<Pick<Profile, 'display_locale' | 'daily_goal_minutes'>>; Relationships: []}
    };
    Views: Record<string, never>;
    Functions: {
      get_learning_progress: {Args: Record<string, never>; Returns: Json};
      submit_practice: {Args: {p_session_id: string; p_lesson_id: string; p_duration_seconds: number; p_answers: Json}; Returns: Json};
      reset_learning_progress: {Args: Record<string, never>; Returns: Json}
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  }
};
