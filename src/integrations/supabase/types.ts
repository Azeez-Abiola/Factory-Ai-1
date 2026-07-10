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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      alert_rules: {
        Row: {
          auto_assign_role: string | null
          conditions: Json
          confidence_threshold: number
          cooldown_seconds: number
          created_at: string
          created_by: string | null
          debounce_seconds: number
          description: string | null
          enabled: boolean
          escalation_minutes: number
          id: string
          name: string
          notification_channels: string[]
          policy_id: string | null
          trigger_source: string
          updated_at: string
        }
        Insert: {
          auto_assign_role?: string | null
          conditions?: Json
          confidence_threshold?: number
          cooldown_seconds?: number
          created_at?: string
          created_by?: string | null
          debounce_seconds?: number
          description?: string | null
          enabled?: boolean
          escalation_minutes?: number
          id?: string
          name: string
          notification_channels?: string[]
          policy_id?: string | null
          trigger_source?: string
          updated_at?: string
        }
        Update: {
          auto_assign_role?: string | null
          conditions?: Json
          confidence_threshold?: number
          cooldown_seconds?: number
          created_at?: string
          created_by?: string | null
          debounce_seconds?: number
          description?: string | null
          enabled?: boolean
          escalation_minutes?: number
          id?: string
          name?: string
          notification_channels?: string[]
          policy_id?: string | null
          trigger_source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "alert_rules_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policies"
            referencedColumns: ["id"]
          },
        ]
      }
      policies: {
        Row: {
          active_hours: Json
          category: string
          compiled_prompt: string | null
          compiled_rule: Json | null
          created_at: string
          created_by: string | null
          description: string | null
          enabled: boolean
          id: string
          name: string
          natural_language: string
          scope_cameras: string[]
          scope_zones: string[]
          severity: string
          updated_at: string
        }
        Insert: {
          active_hours?: Json
          category?: string
          compiled_prompt?: string | null
          compiled_rule?: Json | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          enabled?: boolean
          id?: string
          name: string
          natural_language: string
          scope_cameras?: string[]
          scope_zones?: string[]
          severity?: string
          updated_at?: string
        }
        Update: {
          active_hours?: Json
          category?: string
          compiled_prompt?: string | null
          compiled_rule?: Json | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          enabled?: boolean
          id?: string
          name?: string
          natural_language?: string
          scope_cameras?: string[]
          scope_zones?: string[]
          severity?: string
          updated_at?: string
        }
        Relationships: []
      }
      policy_violations: {
        Row: {
          alert_rule_id: string | null
          camera_id: string | null
          confidence: number | null
          created_at: string
          detected_at: string
          evidence: Json
          id: string
          policy_id: string | null
          resolved_at: string | null
          severity: string
          status: string
          zone: string | null
        }
        Insert: {
          alert_rule_id?: string | null
          camera_id?: string | null
          confidence?: number | null
          created_at?: string
          detected_at?: string
          evidence?: Json
          id?: string
          policy_id?: string | null
          resolved_at?: string | null
          severity?: string
          status?: string
          zone?: string | null
        }
        Update: {
          alert_rule_id?: string | null
          camera_id?: string | null
          confidence?: number | null
          created_at?: string
          detected_at?: string
          evidence?: Json
          id?: string
          policy_id?: string | null
          resolved_at?: string | null
          severity?: string
          status?: string
          zone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "policy_violations_alert_rule_id_fkey"
            columns: ["alert_rule_id"]
            isOneToOne: false
            referencedRelation: "alert_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policy_violations_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policies"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          job_title: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          job_title?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          job_title?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "super_admin" | "tenant_admin" | "operator" | "viewer"
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
      app_role: ["super_admin", "tenant_admin", "operator", "viewer"],
    },
  },
} as const
