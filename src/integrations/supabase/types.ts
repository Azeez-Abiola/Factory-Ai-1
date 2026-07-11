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
      alerts: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          camera_id: string | null
          created_at: string
          description: string | null
          detected_at: string
          id: string
          metadata: Json | null
          resolved_at: string | null
          resolved_by: string | null
          risk_score: number | null
          severity: string
          status: string
          tenant_id: string
          title: string
          type: string
          updated_at: string
          zone: string | null
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          camera_id?: string | null
          created_at?: string
          description?: string | null
          detected_at?: string
          id?: string
          metadata?: Json | null
          resolved_at?: string | null
          resolved_by?: string | null
          risk_score?: number | null
          severity?: string
          status?: string
          tenant_id: string
          title: string
          type: string
          updated_at?: string
          zone?: string | null
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          camera_id?: string | null
          created_at?: string
          description?: string | null
          detected_at?: string
          id?: string
          metadata?: Json | null
          resolved_at?: string | null
          resolved_by?: string | null
          risk_score?: number | null
          severity?: string
          status?: string
          tenant_id?: string
          title?: string
          type?: string
          updated_at?: string
          zone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "alerts_camera_id_fkey"
            columns: ["camera_id"]
            isOneToOne: false
            referencedRelation: "cameras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: string | null
          metadata: Json | null
          tenant_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          tenant_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      cameras: {
        Row: {
          created_at: string
          heartbeat_interval_seconds: number
          id: string
          last_seen_at: string | null
          metadata: Json | null
          name: string
          resolution: string | null
          retention_days: number
          rtsp_url: string | null
          status: string
          stream_type: string
          stream_url: string | null
          tenant_id: string
          type: string | null
          updated_at: string
          zone: string | null
        }
        Insert: {
          created_at?: string
          heartbeat_interval_seconds?: number
          id?: string
          last_seen_at?: string | null
          metadata?: Json | null
          name: string
          resolution?: string | null
          retention_days?: number
          rtsp_url?: string | null
          status?: string
          stream_type?: string
          stream_url?: string | null
          tenant_id: string
          type?: string | null
          updated_at?: string
          zone?: string | null
        }
        Update: {
          created_at?: string
          heartbeat_interval_seconds?: number
          id?: string
          last_seen_at?: string | null
          metadata?: Json | null
          name?: string
          resolution?: string | null
          retention_days?: number
          rtsp_url?: string | null
          status?: string
          stream_type?: string
          stream_url?: string | null
          tenant_id?: string
          type?: string | null
          updated_at?: string
          zone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cameras_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      escalation_policies: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          supervisor_ids: string[]
          tenant_id: string
          timeout_minutes: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          supervisor_ids?: string[]
          tenant_id: string
          timeout_minutes?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          supervisor_ids?: string[]
          tenant_id?: string
          timeout_minutes?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "escalation_policies_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      incidents: {
        Row: {
          alert_id: string | null
          assigned_to: string | null
          closed_at: string | null
          created_at: string
          created_by: string | null
          escalation_level: number
          id: string
          last_escalated_at: string | null
          next_escalation_at: string | null
          notes: string | null
          opened_at: string
          severity: string | null
          status: string
          tenant_id: string
          timeline: Json
          title: string
          updated_at: string
        }
        Insert: {
          alert_id?: string | null
          assigned_to?: string | null
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          escalation_level?: number
          id?: string
          last_escalated_at?: string | null
          next_escalation_at?: string | null
          notes?: string | null
          opened_at?: string
          severity?: string | null
          status?: string
          tenant_id: string
          timeline?: Json
          title: string
          updated_at?: string
        }
        Update: {
          alert_id?: string | null
          assigned_to?: string | null
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          escalation_level?: number
          id?: string
          last_escalated_at?: string | null
          next_escalation_at?: string | null
          notes?: string | null
          opened_at?: string
          severity?: string | null
          status?: string
          tenant_id?: string
          timeline?: Json
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "incidents_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "alerts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
      resolution_tasks: {
        Row: {
          alert_id: string | null
          assigned_to: string | null
          completed_at: string | null
          completion_notes: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_at: string | null
          id: string
          incident_id: string | null
          metadata: Json | null
          priority: string
          status: string
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          alert_id?: string | null
          assigned_to?: string | null
          completed_at?: string | null
          completion_notes?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_at?: string | null
          id?: string
          incident_id?: string | null
          metadata?: Json | null
          priority?: string
          status?: string
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          alert_id?: string | null
          assigned_to?: string | null
          completed_at?: string | null
          completion_notes?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_at?: string | null
          id?: string
          incident_id?: string | null
          metadata?: Json | null
          priority?: string
          status?: string
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "resolution_tasks_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "alerts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resolution_tasks_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resolution_tasks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_members: {
        Row: {
          created_at: string
          id: string
          role: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: string
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_members_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          address: string | null
          branding: Json | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          created_by: string | null
          id: string
          industry: string | null
          name: string
          parent_id: string | null
          plan: string
          slug: string
          status: string
          timezone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          branding?: Json | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          industry?: string | null
          name: string
          parent_id?: string | null
          plan?: string
          slug: string
          status?: string
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          branding?: Json | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          industry?: string | null
          name?: string
          parent_id?: string | null
          plan?: string
          slug?: string
          status?: string
          timezone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenants_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
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
      is_tenant_member: {
        Args: { _tenant_id: string; _user_id: string }
        Returns: boolean
      }
      tenant_role: {
        Args: { _tenant_id: string; _user_id: string }
        Returns: string
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
