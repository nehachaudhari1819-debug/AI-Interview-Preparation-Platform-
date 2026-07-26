export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          operationName?: string
          query?: string
          variables?: Json
          extensions?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          actor_type: string
          actor_user_id: string | null
          created_at: string
          id: string
          ip_address: unknown | null
          metadata: Json | null
          request_id: string | null
          resource_id: string | null
          resource_type: string
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_type?: string
          actor_user_id?: string | null
          created_at?: string
          id?: string
          ip_address?: unknown | null
          metadata?: Json | null
          request_id?: string | null
          resource_id?: string | null
          resource_type: string
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_type?: string
          actor_user_id?: string | null
          created_at?: string
          id?: string
          ip_address?: unknown | null
          metadata?: Json | null
          request_id?: string | null
          resource_id?: string | null
          resource_type?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      idempotency_records: {
        Row: {
          attempt_count: number
          created_at: string
          expires_at: string
          id: string
          idempotency_key: string
          lease_expires_at: string | null
          lease_token: string | null
          locked_until: string | null
          operation: string
          request_hash: string
          resource_id: string | null
          resource_type: string | null
          response_body: Json | null
          response_status: number | null
          status: Database["public"]["Enums"]["idempotency_status_enum"]
          updated_at: string
          user_id: string
        }
        Insert: {
          attempt_count?: number
          created_at?: string
          expires_at: string
          id?: string
          idempotency_key: string
          lease_expires_at?: string | null
          lease_token?: string | null
          locked_until?: string | null
          operation: string
          request_hash: string
          resource_id?: string | null
          resource_type?: string | null
          response_body?: Json | null
          response_status?: number | null
          status?: Database["public"]["Enums"]["idempotency_status_enum"]
          updated_at?: string
          user_id: string
        }
        Update: {
          attempt_count?: number
          created_at?: string
          expires_at?: string
          id?: string
          idempotency_key?: string
          lease_expires_at?: string | null
          lease_token?: string | null
          locked_until?: string | null
          operation?: string
          request_hash?: string
          resource_id?: string | null
          resource_type?: string | null
          response_body?: Json | null
          response_status?: number | null
          status?: Database["public"]["Enums"]["idempotency_status_enum"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "idempotency_records_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      question_categories: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          id: string
          is_active: boolean
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      question_difficulties: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          id: string
          is_active: boolean
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      question_internal_data: {
        Row: {
          evaluation_guidance: string | null
          question_id: string
          reference_answer: string | null
          updated_at: string
        }
        Insert: {
          evaluation_guidance?: string | null
          question_id: string
          reference_answer?: string | null
          updated_at?: string
        }
        Update: {
          evaluation_guidance?: string | null
          question_id?: string
          reference_answer?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_internal_data_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: true
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      question_interview_types: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          id: string
          is_active: boolean
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      question_skill_mappings: {
        Row: {
          created_at: string
          question_id: string
          skill_id: string
        }
        Insert: {
          created_at?: string
          question_id: string
          skill_id: string
        }
        Update: {
          created_at?: string
          question_id?: string
          skill_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_skill_mappings_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_skill_mappings_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "question_skills"
            referencedColumns: ["id"]
          },
        ]
      }
      question_skills: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          id: string
          is_active: boolean
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      question_topic_mappings: {
        Row: {
          created_at: string
          question_id: string
          topic_id: string
        }
        Insert: {
          created_at?: string
          question_id: string
          topic_id: string
        }
        Update: {
          created_at?: string
          question_id?: string
          topic_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_topic_mappings_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_topic_mappings_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "question_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      question_topics: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          id: string
          is_active: boolean
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      questions: {
        Row: {
          archived_at: string | null
          category_id: string
          created_at: string
          created_by: string
          difficulty_id: string
          id: string
          interview_type_id: string
          published_at: string | null
          question_text: string
          question_text_search: unknown | null
          status: Database["public"]["Enums"]["question_status_enum"]
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          category_id: string
          created_at?: string
          created_by: string
          difficulty_id: string
          id?: string
          interview_type_id: string
          published_at?: string | null
          question_text: string
          question_text_search?: unknown | null
          status?: Database["public"]["Enums"]["question_status_enum"]
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          category_id?: string
          created_at?: string
          created_by?: string
          difficulty_id?: string
          id?: string
          interview_type_id?: string
          published_at?: string | null
          question_text?: string
          question_text_search?: unknown | null
          status?: Database["public"]["Enums"]["question_status_enum"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "questions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "question_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_difficulty_id_fkey"
            columns: ["difficulty_id"]
            isOneToOne: false
            referencedRelation: "question_difficulties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_interview_type_id_fkey"
            columns: ["interview_type_id"]
            isOneToOne: false
            referencedRelation: "question_interview_types"
            referencedColumns: ["id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          created_at: string
          locale: string
          practice_reminders_enabled: boolean
          product_updates_enabled: boolean
          time_zone: string
          updated_at: string
          user_id: string
          weekly_progress_summary_enabled: boolean
        }
        Insert: {
          created_at?: string
          locale?: string
          practice_reminders_enabled?: boolean
          product_updates_enabled?: boolean
          time_zone?: string
          updated_at?: string
          user_id: string
          weekly_progress_summary_enabled?: boolean
        }
        Update: {
          created_at?: string
          locale?: string
          practice_reminders_enabled?: boolean
          product_updates_enabled?: boolean
          time_zone?: string
          updated_at?: string
          user_id?: string
          weekly_progress_summary_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "user_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          account_status: Database["public"]["Enums"]["account_status_enum"]
          avatar_url: string | null
          bio: string | null
          branch: string | null
          college: string | null
          created_at: string
          deleted_at: string | null
          email: string
          experience_level:
            | Database["public"]["Enums"]["experience_level_enum"]
            | null
          full_name: string
          graduation_year: number | null
          id: string
          preferred_roles: string[] | null
          role: Database["public"]["Enums"]["user_role_enum"]
          updated_at: string
        }
        Insert: {
          account_status?: Database["public"]["Enums"]["account_status_enum"]
          avatar_url?: string | null
          bio?: string | null
          branch?: string | null
          college?: string | null
          created_at?: string
          deleted_at?: string | null
          email: string
          experience_level?:
            | Database["public"]["Enums"]["experience_level_enum"]
            | null
          full_name: string
          graduation_year?: number | null
          id: string
          preferred_roles?: string[] | null
          role?: Database["public"]["Enums"]["user_role_enum"]
          updated_at?: string
        }
        Update: {
          account_status?: Database["public"]["Enums"]["account_status_enum"]
          avatar_url?: string | null
          bio?: string | null
          branch?: string | null
          college?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string
          experience_level?:
            | Database["public"]["Enums"]["experience_level_enum"]
            | null
          full_name?: string
          graduation_year?: number | null
          id?: string
          preferred_roles?: string[] | null
          role?: Database["public"]["Enums"]["user_role_enum"]
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      acquire_idempotency_lease: {
        Args: {
          p_user_id: string
          p_operation: string
          p_idempotency_key: string
          p_request_hash: string
          p_lease_duration_sec: number
        }
        Returns: Json
      }
      complete_idempotency_lease: {
        Args: {
          p_record_id: string
          p_lease_token: string
          p_response_status: number
          p_response_body: Json
        }
        Returns: boolean
      }
      fail_idempotency_lease: {
        Args: {
          p_record_id: string
          p_lease_token: string
        }
        Returns: boolean
      }
      finalize_soft_delete_account: {
        Args: {
          p_user_id: string
          p_idempotency_key: string
          p_operation: string
          p_request_id?: string
        }
        Returns: Json
      }
      get_current_account_access_state: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      prepare_soft_delete_account: {
        Args: {
          p_user_id: string
          p_idempotency_key: string
          p_request_hash: string
          p_operation: string
        }
        Returns: Json
      }
    }
    Enums: {
      account_status_enum:
        | "active"
        | "suspended"
        | "deletion_pending"
        | "deleted"
      experience_level_enum:
        | "fresher"
        | "beginner"
        | "intermediate"
        | "advanced"
      idempotency_status_enum: "processing" | "completed" | "failed"
      question_status_enum: "draft" | "published" | "archived"
      user_role_enum: "student" | "admin"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof PublicSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof PublicSchema["CompositeTypes"]
    ? PublicSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

