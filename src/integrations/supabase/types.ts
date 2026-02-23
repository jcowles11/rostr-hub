export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      coaches: {
        Row: {
          color: string
          created_at: string
          email: string
          full_name: string
          id: string
          program_id: string
          role: Database["public"]["Enums"]["coach_role"]
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          email: string
          full_name: string
          id?: string
          program_id: string
          role?: Database["public"]["Enums"]["coach_role"]
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          program_id?: string
          role?: Database["public"]["Enums"]["coach_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coaches_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluations: {
        Row: {
          coach_id: string
          created_at: string
          id: string
          metric_id: string
          player_id: string
          program_id: string
          session_id: string | null
          updated_at: string
          value: number
        }
        Insert: {
          coach_id: string
          created_at?: string
          id?: string
          metric_id: string
          player_id: string
          program_id: string
          session_id?: string | null
          updated_at?: string
          value: number
        }
        Update: {
          coach_id?: string
          created_at?: string
          id?: string
          metric_id?: string
          player_id?: string
          program_id?: string
          session_id?: string | null
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "evaluations_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluations_metric_id_fkey"
            columns: ["metric_id"]
            isOneToOne: false
            referencedRelation: "metrics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluations_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluations_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluations_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "tryout_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      metrics: {
        Row: {
          aggregation: Database["public"]["Enums"]["aggregation_method"]
          category: Database["public"]["Enums"]["metric_category"]
          created_at: string
          id: string
          is_default: boolean
          max_value: number | null
          metric_type: Database["public"]["Enums"]["metric_type"]
          min_value: number | null
          name: string
          program_id: string
          sort_order: number
          unit: string
          visible_to_players: boolean
        }
        Insert: {
          aggregation?: Database["public"]["Enums"]["aggregation_method"]
          category?: Database["public"]["Enums"]["metric_category"]
          created_at?: string
          id?: string
          is_default?: boolean
          max_value?: number | null
          metric_type?: Database["public"]["Enums"]["metric_type"]
          min_value?: number | null
          name: string
          program_id: string
          sort_order?: number
          unit?: string
          visible_to_players?: boolean
        }
        Update: {
          aggregation?: Database["public"]["Enums"]["aggregation_method"]
          category?: Database["public"]["Enums"]["metric_category"]
          created_at?: string
          id?: string
          is_default?: boolean
          max_value?: number | null
          metric_type?: Database["public"]["Enums"]["metric_type"]
          min_value?: number | null
          name?: string
          program_id?: string
          sort_order?: number
          unit?: string
          visible_to_players?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "metrics_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      player_notes: {
        Row: {
          coach_id: string
          content: string
          created_at: string
          flag: Database["public"]["Enums"]["player_flag"] | null
          id: string
          player_id: string
          program_id: string
          session_id: string | null
          updated_at: string
        }
        Insert: {
          coach_id: string
          content: string
          created_at?: string
          flag?: Database["public"]["Enums"]["player_flag"] | null
          id?: string
          player_id: string
          program_id: string
          session_id?: string | null
          updated_at?: string
        }
        Update: {
          coach_id?: string
          content?: string
          created_at?: string
          flag?: Database["public"]["Enums"]["player_flag"] | null
          id?: string
          player_id?: string
          program_id?: string
          session_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_notes_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_notes_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_notes_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_notes_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "tryout_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          bats: string | null
          created_at: string
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          first_name: string
          grade: number | null
          id: string
          jersey_number_preference: number | null
          last_name: string
          medical_notes: string | null
          photo_url: string | null
          player_number: number | null
          positions: string[] | null
          program_id: string
          results_visible: boolean | null
          throws: string | null
          travel_ball_experience: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          bats?: string | null
          created_at?: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          first_name: string
          grade?: number | null
          id?: string
          jersey_number_preference?: number | null
          last_name: string
          medical_notes?: string | null
          photo_url?: string | null
          player_number?: number | null
          positions?: string[] | null
          program_id: string
          results_visible?: boolean | null
          throws?: string | null
          travel_ball_experience?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          bats?: string | null
          created_at?: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          first_name?: string
          grade?: number | null
          id?: string
          jersey_number_preference?: number | null
          last_name?: string
          medical_notes?: string | null
          photo_url?: string | null
          player_number?: number | null
          positions?: string[] | null
          program_id?: string
          results_visible?: boolean | null
          throws?: string | null
          travel_ball_experience?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "players_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      programs: {
        Row: {
          created_at: string
          created_by: string
          id: string
          levels: string[]
          logo_url: string | null
          name: string
          registration_code: string
          results_public: boolean
          school_name: string
          sport: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          levels?: string[]
          logo_url?: string | null
          name: string
          registration_code?: string
          results_public?: boolean
          school_name: string
          sport?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          levels?: string[]
          logo_url?: string | null
          name?: string
          registration_code?: string
          results_public?: boolean
          school_name?: string
          sport?: string
          updated_at?: string
        }
        Relationships: []
      }
      roster_assignments: {
        Row: {
          assigned_by: string
          assignment: string
          created_at: string
          id: string
          notes: string | null
          player_id: string
          program_id: string
          updated_at: string
        }
        Insert: {
          assigned_by: string
          assignment: string
          created_at?: string
          id?: string
          notes?: string | null
          player_id: string
          program_id: string
          updated_at?: string
        }
        Update: {
          assigned_by?: string
          assignment?: string
          created_at?: string
          id?: string
          notes?: string | null
          player_id?: string
          program_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "roster_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roster_assignments_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: true
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roster_assignments_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      session_attendance: {
        Row: {
          checked_in: boolean
          checked_in_at: string | null
          id: string
          player_id: string
          session_id: string
        }
        Insert: {
          checked_in?: boolean
          checked_in_at?: string | null
          id?: string
          player_id: string
          session_id: string
        }
        Update: {
          checked_in?: boolean
          checked_in_at?: string | null
          id?: string
          player_id?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_attendance_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_attendance_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "tryout_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      tryout_sessions: {
        Row: {
          created_at: string
          id: string
          name: string
          notes: string | null
          program_id: string
          session_date: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          program_id: string
          session_date?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          program_id?: string
          session_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "tryout_sessions_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_head_coach: {
        Args: { _program_id: string; _user_id: string }
        Returns: boolean
      }
      is_program_coach: {
        Args: { _program_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      aggregation_method: "best" | "average" | "latest"
      coach_role: "head_coach" | "assistant_coach"
      metric_category: "running" | "hitting" | "fielding" | "pitching" | "other"
      metric_type: "timed" | "measured" | "rated"
      player_flag: "standout" | "needs_second_look" | "concern"
      roster_assignment: "varsity" | "jv" | "freshman" | "cut"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      aggregation_method: ["best", "average", "latest"],
      coach_role: ["head_coach", "assistant_coach"],
      metric_category: ["running", "hitting", "fielding", "pitching", "other"],
      metric_type: ["timed", "measured", "rated"],
      player_flag: ["standout", "needs_second_look", "concern"],
      roster_assignment: ["varsity", "jv", "freshman", "cut"],
    },
  },
} as const
