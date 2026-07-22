export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          full_name: string;
          college: string | null;
          branch: string | null;
          graduation_year: number | null;
          experience_level: "fresher" | "beginner" | "intermediate" | "advanced" | null;
          preferred_roles: string[] | null;
          bio: string | null;
          avatar_url: string | null;
          role: "student" | "admin";
          account_status: "active" | "suspended" | "deletion_pending" | "deleted";
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id: string;
          email: string;
          full_name: string;
          college?: string | null;
          branch?: string | null;
          graduation_year?: number | null;
          experience_level?: "fresher" | "beginner" | "intermediate" | "advanced" | null;
          preferred_roles?: string[] | null;
          bio?: string | null;
          avatar_url?: string | null;
          role?: "student" | "admin";
          account_status?: "active" | "suspended" | "deletion_pending" | "deleted";
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string;
          college?: string | null;
          branch?: string | null;
          graduation_year?: number | null;
          experience_level?: "fresher" | "beginner" | "intermediate" | "advanced" | null;
          preferred_roles?: string[] | null;
          bio?: string | null;
          avatar_url?: string | null;
          role?: "student" | "admin";
          account_status?: "active" | "suspended" | "deletion_pending" | "deleted";
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
      };
      idempotency_records: {
        Row: {
          id: string;
          user_id: string;
          idempotency_key: string;
          operation: string;
          request_hash: string;
          status: "processing" | "completed" | "failed";
          resource_type: string | null;
          resource_id: string | null;
          response_status: number | null;
          response_body: Json | null;
          locked_until: string | null;
          expires_at: string;
          created_at: string;
          updated_at: string;
        };
      };
      audit_logs: {
        Row: {
          id: string;
          actor_user_id: string | null;
          actor_type: string;
          action: string;
          resource_type: string;
          resource_id: string | null;
          metadata: Json | null;
          request_id: string | null;
          ip_address: string | null;
          user_agent: string | null;
          created_at: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      is_active_user: {
        Args: Record<string, never>;
        Returns: boolean;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
