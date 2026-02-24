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
          attempt_number: number
          coach_id: string
          created_at: string
          id: string
          metric_id: string
          player_id: string
          program_id: string
          season_id: string | null
          session_id: string | null
          updated_at: string
          value: number
        }
        Insert: {
          attempt_number?: number
          coach_id: string
          created_at?: string
          id?: string
          metric_id: string
          player_id: string
          program_id: string
          season_id?: string | null
          session_id?: string | null
          updated_at?: string
          value: number
        }
        Update: {
          attempt_number?: number
          coach_id?: string
          created_at?: string
          id?: string
          metric_id?: string
          player_id?: string
          program_id?: string
          season_id?: string | null
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
            foreignKeyName: "evaluations_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
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
      evaluator_entries: {
        Row: {
          created_at: string
          evaluator_id: string
          event_date: string | null
          event_name: string | null
          id: string
          metric_name: string
          metric_type: string
          metric_unit: string
          metric_value: number
          notes: string | null
          player_id: string
        }
        Insert: {
          created_at?: string
          evaluator_id: string
          event_date?: string | null
          event_name?: string | null
          id?: string
          metric_name: string
          metric_type?: string
          metric_unit?: string
          metric_value: number
          notes?: string | null
          player_id: string
        }
        Update: {
          created_at?: string
          evaluator_id?: string
          event_date?: string | null
          event_name?: string | null
          id?: string
          metric_name?: string
          metric_type?: string
          metric_unit?: string
          metric_value?: number
          notes?: string | null
          player_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "evaluator_entries_evaluator_id_fkey"
            columns: ["evaluator_id"]
            isOneToOne: false
            referencedRelation: "evaluators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluator_entries_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluators: {
        Row: {
          created_at: string
          full_name: string
          id: string
          organization_name: string
          sport: string
          title: string | null
          user_id: string
          verified: boolean
        }
        Insert: {
          created_at?: string
          full_name: string
          id?: string
          organization_name?: string
          sport?: string
          title?: string | null
          user_id: string
          verified?: boolean
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          organization_name?: string
          sport?: string
          title?: string | null
          user_id?: string
          verified?: boolean
        }
        Relationships: []
      }
      follows: {
        Row: {
          created_at: string
          followed_player_id: string
          follower_id: string
          id: string
        }
        Insert: {
          created_at?: string
          followed_player_id: string
          follower_id: string
          id?: string
        }
        Update: {
          created_at?: string
          followed_player_id?: string
          follower_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follows_followed_player_id_fkey"
            columns: ["followed_player_id"]
            isOneToOne: false
            referencedRelation: "players"
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
          max_attempts: number
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
          max_attempts?: number
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
          max_attempts?: number
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
      organization_members: {
        Row: {
          color: string
          created_at: string
          email: string
          full_name: string
          id: string
          organization_id: string | null
          program_id: string | null
          role: Database["public"]["Enums"]["app_role"]
          team_id: string | null
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          email: string
          full_name: string
          id?: string
          organization_id?: string | null
          program_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          team_id?: string | null
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          organization_id?: string | null
          program_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          team_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          created_by: string
          id: string
          logo_url: string | null
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          logo_url?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          logo_url?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      player_club_teams: {
        Row: {
          created_at: string
          id: string
          is_current: boolean
          name: string
          player_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_current?: boolean
          name: string
          player_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_current?: boolean
          name?: string
          player_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_club_teams_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
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
          birthday: string | null
          city: string | null
          commitment_date: string | null
          committed_school_logo_url: string | null
          committed_school_name: string | null
          created_at: string
          email: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          first_name: string
          gamechanger_profile_url: string | null
          gpa: string | null
          grade: number | null
          graduation_year: number | null
          height: string | null
          high_school: string | null
          highlight_video_url: string | null
          id: string
          jersey_number_preference: number | null
          last_name: string
          maxpreps_profile_url: string | null
          medical_notes: string | null
          phone: string | null
          photo_url: string | null
          player_number: number | null
          positions: string[] | null
          profile_public: boolean
          profile_slug: string | null
          program_id: string | null
          recruiting_status: string
          results_visible: boolean | null
          show_contact_info: boolean
          social_instagram: string | null
          social_twitter: string | null
          state: string | null
          team_id: string | null
          throws: string | null
          travel_ball_experience: string | null
          updated_at: string
          user_id: string | null
          weight: number | null
        }
        Insert: {
          bats?: string | null
          birthday?: string | null
          city?: string | null
          commitment_date?: string | null
          committed_school_logo_url?: string | null
          committed_school_name?: string | null
          created_at?: string
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          first_name: string
          gamechanger_profile_url?: string | null
          gpa?: string | null
          grade?: number | null
          graduation_year?: number | null
          height?: string | null
          high_school?: string | null
          highlight_video_url?: string | null
          id?: string
          jersey_number_preference?: number | null
          last_name: string
          maxpreps_profile_url?: string | null
          medical_notes?: string | null
          phone?: string | null
          photo_url?: string | null
          player_number?: number | null
          positions?: string[] | null
          profile_public?: boolean
          profile_slug?: string | null
          program_id?: string | null
          recruiting_status?: string
          results_visible?: boolean | null
          show_contact_info?: boolean
          social_instagram?: string | null
          social_twitter?: string | null
          state?: string | null
          team_id?: string | null
          throws?: string | null
          travel_ball_experience?: string | null
          updated_at?: string
          user_id?: string | null
          weight?: number | null
        }
        Update: {
          bats?: string | null
          birthday?: string | null
          city?: string | null
          commitment_date?: string | null
          committed_school_logo_url?: string | null
          committed_school_name?: string | null
          created_at?: string
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          first_name?: string
          gamechanger_profile_url?: string | null
          gpa?: string | null
          grade?: number | null
          graduation_year?: number | null
          height?: string | null
          high_school?: string | null
          highlight_video_url?: string | null
          id?: string
          jersey_number_preference?: number | null
          last_name?: string
          maxpreps_profile_url?: string | null
          medical_notes?: string | null
          phone?: string | null
          photo_url?: string | null
          player_number?: number | null
          positions?: string[] | null
          profile_public?: boolean
          profile_slug?: string | null
          program_id?: string | null
          recruiting_status?: string
          results_visible?: boolean | null
          show_contact_info?: boolean
          social_instagram?: string | null
          social_twitter?: string | null
          state?: string | null
          team_id?: string | null
          throws?: string | null
          travel_ball_experience?: string | null
          updated_at?: string
          user_id?: string | null
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "players_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "players_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      post_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_likes: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          author_id: string
          caption: string | null
          comment_count: number
          created_at: string
          id: string
          like_count: number
          media_urls: string[] | null
          player_id: string | null
          post_type: string
          sport: string | null
          updated_at: string
        }
        Insert: {
          author_id: string
          caption?: string | null
          comment_count?: number
          created_at?: string
          id?: string
          like_count?: number
          media_urls?: string[] | null
          player_id?: string | null
          post_type?: string
          sport?: string | null
          updated_at?: string
        }
        Update: {
          author_id?: string
          caption?: string | null
          comment_count?: number
          created_at?: string
          id?: string
          like_count?: number
          media_urls?: string[] | null
          player_id?: string | null
          post_type?: string
          sport?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
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
          organization_id: string
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
          organization_id: string
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
          organization_id?: string
          registration_code?: string
          results_public?: boolean
          school_name?: string
          sport?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "programs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
      scouts: {
        Row: {
          created_at: string
          full_name: string
          id: string
          organization_name: string
          title: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          full_name: string
          id?: string
          organization_name?: string
          title?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          organization_name?: string
          title?: string | null
          user_id?: string
        }
        Relationships: []
      }
      seasons: {
        Row: {
          created_at: string
          end_date: string | null
          id: string
          is_active: boolean
          name: string
          program_id: string
          start_date: string | null
        }
        Insert: {
          created_at?: string
          end_date?: string | null
          id?: string
          is_active?: boolean
          name: string
          program_id: string
          start_date?: string | null
        }
        Update: {
          created_at?: string
          end_date?: string | null
          id?: string
          is_active?: boolean
          name?: string
          program_id?: string
          start_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "seasons_program_id_fkey"
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
      teams: {
        Row: {
          created_at: string
          id: string
          name: string
          program_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          program_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          program_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
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
          season_id: string | null
          session_date: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          program_id: string
          season_id?: string | null
          session_date?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          program_id?: string
          season_id?: string | null
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
          {
            foreignKeyName: "tryout_sessions_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_public_profile: { Args: { _slug: string }; Returns: Json }
      get_social_feed: { Args: { _limit?: number }; Returns: Json }
      has_program_access: {
        Args: { _program_id: string; _user_id: string }
        Returns: boolean
      }
      has_team_access: {
        Args: { _team_id: string; _user_id: string }
        Returns: boolean
      }
      is_head_coach: {
        Args: { _program_id: string; _user_id: string }
        Returns: boolean
      }
      is_org_admin: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      is_org_member: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      is_program_admin: {
        Args: { _program_id: string; _user_id: string }
        Returns: boolean
      }
      is_program_coach: {
        Args: { _program_id: string; _user_id: string }
        Returns: boolean
      }
      search_public_players:
        | {
            Args: {
              _bats?: string
              _grad_year_max?: number
              _grad_year_min?: number
              _limit?: number
              _name_search?: string
              _offset?: number
              _positions?: string[]
              _recruiting_status?: string
              _sport?: string
              _throws?: string
            }
            Returns: Json
          }
        | {
            Args: {
              _bats?: string
              _gpa_min?: number
              _grad_year_max?: number
              _grad_year_min?: number
              _limit?: number
              _name_search?: string
              _offset?: number
              _positions?: string[]
              _recruiting_status?: string
              _sport?: string
              _state?: string
              _throws?: string
            }
            Returns: Json
          }
    }
    Enums: {
      aggregation_method: "best" | "average" | "latest"
      app_role: "admin" | "coach"
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
      app_role: ["admin", "coach"],
      coach_role: ["head_coach", "assistant_coach"],
      metric_category: ["running", "hitting", "fielding", "pitching", "other"],
      metric_type: ["timed", "measured", "rated"],
      player_flag: ["standout", "needs_second_look", "concern"],
      roster_assignment: ["varsity", "jv", "freshman", "cut"],
    },
  },
} as const
