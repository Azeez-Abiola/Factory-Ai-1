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
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
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
      ai_analysis_config: {
        Row: {
          categories: Json
          created_at: string
          custom_models: Json
          defect_types: Json
          id: string
          model: string
          reference_images: Json
          system_prompt: string
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          categories?: Json
          created_at?: string
          custom_models?: Json
          defect_types?: Json
          id?: string
          model?: string
          reference_images?: Json
          system_prompt?: string
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          categories?: Json
          created_at?: string
          custom_models?: Json
          defect_types?: Json
          id?: string
          model?: string
          reference_images?: Json
          system_prompt?: string
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_analysis_config_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_insights: {
        Row: {
          category: string
          confidence: number
          created_at: string
          description: string
          evidence: Json
          generated_at: string
          id: string
          impact: string
          metric_label: string | null
          metric_value: string | null
          period_end: string | null
          period_start: string | null
          recommendation: string
          tenant_id: string
          title: string
          trend: string
        }
        Insert: {
          category?: string
          confidence?: number
          created_at?: string
          description?: string
          evidence?: Json
          generated_at?: string
          id?: string
          impact?: string
          metric_label?: string | null
          metric_value?: string | null
          period_end?: string | null
          period_start?: string | null
          recommendation?: string
          tenant_id: string
          title: string
          trend?: string
        }
        Update: {
          category?: string
          confidence?: number
          created_at?: string
          description?: string
          evidence?: Json
          generated_at?: string
          id?: string
          impact?: string
          metric_label?: string | null
          metric_value?: string | null
          period_end?: string | null
          period_start?: string | null
          recommendation?: string
          tenant_id?: string
          title?: string
          trend?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_insights_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage_events: {
        Row: {
          camera_id: string | null
          cost_usd: number
          created_at: string
          id: string
          media: string
          metadata: Json
          model: string | null
          scene_changed: boolean
          scene_delta: number | null
          source: string
          tenant_id: string
        }
        Insert: {
          camera_id?: string | null
          cost_usd?: number
          created_at?: string
          id?: string
          media?: string
          metadata?: Json
          model?: string | null
          scene_changed?: boolean
          scene_delta?: number | null
          source?: string
          tenant_id: string
        }
        Update: {
          camera_id?: string | null
          cost_usd?: number
          created_at?: string
          id?: string
          media?: string
          metadata?: Json
          model?: string | null
          scene_changed?: boolean
          scene_delta?: number | null
          source?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_events_camera_id_fkey"
            columns: ["camera_id"]
            isOneToOne: false
            referencedRelation: "cameras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_usage_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
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
          tenant_id: string | null
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
          tenant_id?: string | null
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
          tenant_id?: string | null
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
          {
            foreignKeyName: "alert_rules_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
      billing_plans: {
        Row: {
          allowance: string
          base_fee: number
          created_at: string
          label: string
          per_camera_fee: number
          plan_key: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          allowance: string
          base_fee: number
          created_at?: string
          label: string
          per_camera_fee: number
          plan_key: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          allowance?: string
          base_fee?: number
          created_at?: string
          label?: string
          per_camera_fee?: number
          plan_key?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      cameras: {
        Row: {
          ai_models: Json
          audio_enabled: boolean
          clip_analysis_enabled: boolean
          clip_seconds: number
          confidence_threshold: number
          created_at: string
          credentials: Json
          fps: number
          frame_signature: string | null
          frames_analyzed: number
          frames_skipped: number
          heartbeat_interval_seconds: number
          id: string
          inference_enabled: boolean
          inference_interval_seconds: number
          inference_status: string
          ingest_token: string | null
          last_frame_change_at: string | null
          last_inference_at: string | null
          last_inference_error: string | null
          last_scene_delta: number | null
          last_seen_at: string | null
          local_direct_enabled: boolean
          local_snapshot_url: string | null
          local_stream_type: string
          local_stream_url: string | null
          max_idle_seconds: number
          metadata: Json | null
          name: string
          ptz_enabled: boolean
          recording_enabled: boolean
          reference_match_enabled: boolean
          reference_match_threshold: number
          reference_samples: Json
          regions_of_interest: Json
          resolution: string | null
          retention_days: number
          rtsp_url: string | null
          scene_change_threshold: number
          scene_gating_enabled: boolean
          snapshot_url: string | null
          status: string
          stream_type: string
          stream_url: string | null
          tenant_id: string
          type: string | null
          updated_at: string
          zone: string | null
        }
        Insert: {
          ai_models?: Json
          audio_enabled?: boolean
          clip_analysis_enabled?: boolean
          clip_seconds?: number
          confidence_threshold?: number
          created_at?: string
          credentials?: Json
          fps?: number
          frame_signature?: string | null
          frames_analyzed?: number
          frames_skipped?: number
          heartbeat_interval_seconds?: number
          id?: string
          inference_enabled?: boolean
          inference_interval_seconds?: number
          inference_status?: string
          ingest_token?: string | null
          last_frame_change_at?: string | null
          last_inference_at?: string | null
          last_inference_error?: string | null
          last_scene_delta?: number | null
          last_seen_at?: string | null
          local_direct_enabled?: boolean
          local_snapshot_url?: string | null
          local_stream_type?: string
          local_stream_url?: string | null
          max_idle_seconds?: number
          metadata?: Json | null
          name: string
          ptz_enabled?: boolean
          recording_enabled?: boolean
          reference_match_enabled?: boolean
          reference_match_threshold?: number
          reference_samples?: Json
          regions_of_interest?: Json
          resolution?: string | null
          retention_days?: number
          rtsp_url?: string | null
          scene_change_threshold?: number
          scene_gating_enabled?: boolean
          snapshot_url?: string | null
          status?: string
          stream_type?: string
          stream_url?: string | null
          tenant_id: string
          type?: string | null
          updated_at?: string
          zone?: string | null
        }
        Update: {
          ai_models?: Json
          audio_enabled?: boolean
          clip_analysis_enabled?: boolean
          clip_seconds?: number
          confidence_threshold?: number
          created_at?: string
          credentials?: Json
          fps?: number
          frame_signature?: string | null
          frames_analyzed?: number
          frames_skipped?: number
          heartbeat_interval_seconds?: number
          id?: string
          inference_enabled?: boolean
          inference_interval_seconds?: number
          inference_status?: string
          ingest_token?: string | null
          last_frame_change_at?: string | null
          last_inference_at?: string | null
          last_inference_error?: string | null
          last_scene_delta?: number | null
          last_seen_at?: string | null
          local_direct_enabled?: boolean
          local_snapshot_url?: string | null
          local_stream_type?: string
          local_stream_url?: string | null
          max_idle_seconds?: number
          metadata?: Json | null
          name?: string
          ptz_enabled?: boolean
          recording_enabled?: boolean
          reference_match_enabled?: boolean
          reference_match_threshold?: number
          reference_samples?: Json
          regions_of_interest?: Json
          resolution?: string | null
          retention_days?: number
          rtsp_url?: string | null
          scene_change_threshold?: number
          scene_gating_enabled?: boolean
          snapshot_url?: string | null
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
      equipment_assets: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          anomaly_type: string | null
          asset_type: string
          camera_id: string | null
          created_at: string
          created_by: string | null
          estimated_time_to_failure: string | null
          failure_probability: number
          health_history: Json
          health_score: number
          id: string
          last_service_at: string | null
          metadata: Json
          name: string
          recommendation: string | null
          status: string
          tenant_id: string
          updated_at: string
          zone: string | null
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          anomaly_type?: string | null
          asset_type?: string
          camera_id?: string | null
          created_at?: string
          created_by?: string | null
          estimated_time_to_failure?: string | null
          failure_probability?: number
          health_history?: Json
          health_score?: number
          id?: string
          last_service_at?: string | null
          metadata?: Json
          name: string
          recommendation?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
          zone?: string | null
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          anomaly_type?: string | null
          asset_type?: string
          camera_id?: string | null
          created_at?: string
          created_by?: string | null
          estimated_time_to_failure?: string | null
          failure_probability?: number
          health_history?: Json
          health_score?: number
          id?: string
          last_service_at?: string | null
          metadata?: Json
          name?: string
          recommendation?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
          zone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "equipment_assets_camera_id_fkey"
            columns: ["camera_id"]
            isOneToOne: false
            referencedRelation: "cameras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_assets_tenant_id_fkey"
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
      notification_log: {
        Row: {
          alert_id: string | null
          channel: string
          created_at: string
          id: string
          incident_id: string | null
          metadata: Json
          reason: string | null
          recipient: string
          status: string
          tenant_id: string
        }
        Insert: {
          alert_id?: string | null
          channel: string
          created_at?: string
          id?: string
          incident_id?: string | null
          metadata?: Json
          reason?: string | null
          recipient: string
          status?: string
          tenant_id: string
        }
        Update: {
          alert_id?: string | null
          channel?: string
          created_at?: string
          id?: string
          incident_id?: string | null
          metadata?: Json
          reason?: string | null
          recipient?: string
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_log_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "alerts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_log_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_log_tenant_id_fkey"
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
          tenant_id: string | null
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
          tenant_id?: string | null
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
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "policies_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
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
          tenant_id: string | null
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
          tenant_id?: string | null
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
          tenant_id?: string | null
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
          {
            foreignKeyName: "policy_violations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          job_title: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          job_title?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
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
      reports: {
        Row: {
          created_at: string
          data: Json
          findings_count: number
          generated_by: string | null
          generated_by_name: string
          id: string
          period_end: string | null
          period_start: string | null
          reference: string
          score: number
          status: string
          summary: string | null
          tenant_id: string
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data?: Json
          findings_count?: number
          generated_by?: string | null
          generated_by_name?: string
          id?: string
          period_end?: string | null
          period_start?: string | null
          reference: string
          score?: number
          status?: string
          summary?: string | null
          tenant_id: string
          title: string
          type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data?: Json
          findings_count?: number
          generated_by?: string | null
          generated_by_name?: string
          id?: string
          period_end?: string | null
          period_start?: string | null
          reference?: string
          score?: number
          status?: string
          summary?: string | null
          tenant_id?: string
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
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
      shifts: {
        Row: {
          acceptance_notes: string | null
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          ended_at: string | null
          handover_notes: string | null
          id: string
          incoming_supervisor_id: string | null
          key_events: Json
          metrics: Json
          name: string
          opening_notes: string | null
          recommendations: Json
          started_at: string
          status: string
          supervisor_id: string
          tenant_id: string
          unresolved_issues: Json
          updated_at: string
        }
        Insert: {
          acceptance_notes?: string | null
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          ended_at?: string | null
          handover_notes?: string | null
          id?: string
          incoming_supervisor_id?: string | null
          key_events?: Json
          metrics?: Json
          name: string
          opening_notes?: string | null
          recommendations?: Json
          started_at?: string
          status?: string
          supervisor_id: string
          tenant_id: string
          unresolved_issues?: Json
          updated_at?: string
        }
        Update: {
          acceptance_notes?: string | null
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          ended_at?: string | null
          handover_notes?: string | null
          id?: string
          incoming_supervisor_id?: string | null
          key_events?: Json
          metrics?: Json
          name?: string
          opening_notes?: string | null
          recommendations?: Json
          started_at?: string
          status?: string
          supervisor_id?: string
          tenant_id?: string
          unresolved_issues?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shifts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      site_requests: {
        Row: {
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          created_tenant_id: string | null
          estimated_cameras: number
          expected_go_live: string | null
          id: string
          justification: string | null
          location: string | null
          requested_by: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          site_name: string
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          created_tenant_id?: string | null
          estimated_cameras?: number
          expected_go_live?: string | null
          id?: string
          justification?: string | null
          location?: string | null
          requested_by?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          site_name: string
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          created_tenant_id?: string | null
          estimated_cameras?: number
          expected_go_live?: string | null
          id?: string
          justification?: string | null
          location?: string | null
          requested_by?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          site_name?: string
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_requests_created_tenant_id_fkey"
            columns: ["created_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      site_zones: {
        Row: {
          color: string
          created_at: string
          created_by: string | null
          description: string | null
          height: number
          id: string
          name: string
          tenant_id: string
          updated_at: string
          width: number
          x: number
          y: number
          zone_type: string
        }
        Insert: {
          color?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          height?: number
          id?: string
          name: string
          tenant_id: string
          updated_at?: string
          width?: number
          x?: number
          y?: number
          zone_type?: string
        }
        Update: {
          color?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          height?: number
          id?: string
          name?: string
          tenant_id?: string
          updated_at?: string
          width?: number
          x?: number
          y?: number
          zone_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_zones_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_ai_budgets: {
        Row: {
          alert_threshold_pct: number
          created_at: string
          enabled: boolean
          hard_stop: boolean
          last_alert_pct: number
          last_alert_period: string | null
          monthly_limit_usd: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          alert_threshold_pct?: number
          created_at?: string
          enabled?: boolean
          hard_stop?: boolean
          last_alert_pct?: number
          last_alert_period?: string | null
          monthly_limit_usd?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          alert_threshold_pct?: number
          created_at?: string
          enabled?: boolean
          hard_stop?: boolean
          last_alert_pct?: number
          last_alert_period?: string | null
          monthly_limit_usd?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_ai_budgets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          role: string
          status: string
          tenant_id: string
          token: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role?: string
          status?: string
          tenant_id: string
          token?: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role?: string
          status?: string
          tenant_id?: string
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_invitations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_kpis: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          critical_threshold: number
          current_value: number
          description: string
          direction: string
          enabled: boolean
          formula: string | null
          id: string
          name: string
          target: number
          tenant_id: string
          unit: string
          updated_at: string
          warning_threshold: number
        }
        Insert: {
          category?: string
          created_at?: string
          created_by?: string | null
          critical_threshold?: number
          current_value?: number
          description?: string
          direction?: string
          enabled?: boolean
          formula?: string | null
          id?: string
          name: string
          target?: number
          tenant_id: string
          unit?: string
          updated_at?: string
          warning_threshold?: number
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          critical_threshold?: number
          current_value?: number
          description?: string
          direction?: string
          enabled?: boolean
          formula?: string | null
          id?: string
          name?: string
          target?: number
          tenant_id?: string
          unit?: string
          updated_at?: string
          warning_threshold?: number
        }
        Relationships: [
          {
            foreignKeyName: "tenant_kpis_tenant_id_fkey"
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
      tenant_notification_prefs: {
        Row: {
          email_enabled: boolean
          email_recipients: string[]
          min_severity: string
          notify_on_escalation: boolean
          quiet_hours_end: string | null
          quiet_hours_start: string | null
          sms_enabled: boolean
          sms_recipients: string[]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          email_enabled?: boolean
          email_recipients?: string[]
          min_severity?: string
          notify_on_escalation?: boolean
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          sms_enabled?: boolean
          sms_recipients?: string[]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          email_enabled?: boolean
          email_recipients?: string[]
          min_severity?: string
          notify_on_escalation?: boolean
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          sms_enabled?: boolean
          sms_recipients?: string[]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_notification_prefs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_role_permissions: {
        Row: {
          allowed: boolean
          created_at: string
          id: string
          permission_key: string
          role: string
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          allowed: boolean
          created_at?: string
          id?: string
          permission_key: string
          role: string
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          allowed?: boolean
          created_at?: string
          id?: string
          permission_key?: string
          role?: string
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_role_permissions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_webhooks: {
        Row: {
          created_at: string
          created_by: string | null
          events: string[]
          id: string
          last_triggered_at: string | null
          name: string
          status: string
          success_rate: number
          tenant_id: string
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          events?: string[]
          id?: string
          last_triggered_at?: string | null
          name: string
          status?: string
          success_rate?: number
          tenant_id: string
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          events?: string[]
          id?: string
          last_triggered_at?: string | null
          name?: string
          status?: string
          success_rate?: number
          tenant_id?: string
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_webhooks_tenant_id_fkey"
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
          settings: Json
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
          settings?: Json
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
          settings?: Json
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
      work_orders: {
        Row: {
          asset_id: string | null
          assigned_to: string | null
          assignee_name: string
          completed_at: string | null
          completion_notes: string | null
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          priority: string
          reference: string
          scheduled_date: string | null
          status: string
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          asset_id?: string | null
          assigned_to?: string | null
          assignee_name: string
          completed_at?: string | null
          completion_notes?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          priority?: string
          reference: string
          scheduled_date?: string | null
          status?: string
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          asset_id?: string | null
          assigned_to?: string | null
          assignee_name?: string
          completed_at?: string | null
          completion_notes?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          priority?: string
          reference?: string
          scheduled_date?: string | null
          status?: string
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_orders_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "equipment_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_tenant_invitation: { Args: { _token: string }; Returns: string }
      ai_budget_status: { Args: { _tenant_id: string }; Returns: Json }
      camera_heartbeat: {
        Args: {
          _camera_id: string
          _fps?: number
          _resolution?: string
          _status?: string
          _token: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_tenant_permission: {
        Args: { _permission_key: string; _tenant_id: string }
        Returns: boolean
      }
      invitation_preview: {
        Args: { _token: string }
        Returns: {
          email: string
          expires_at: string
          role: string
          status: string
          tenant_name: string
        }[]
      }
      is_tenant_member: {
        Args: { _tenant_id: string; _user_id: string }
        Returns: boolean
      }
      pending_signups: {
        Args: never
        Returns: {
          created_at: string
          display_name: string
          email: string
          user_id: string
        }[]
      }
      tenant_member_emails: {
        Args: { _tenant_id: string }
        Returns: {
          email: string
          user_id: string
        }[]
      }
      tenant_role: {
        Args: { _tenant_id: string; _user_id: string }
        Returns: string
      }
      tenant_role_to_app_role: {
        Args: { _role: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
    }
    Enums: {
      app_role:
        | "super_admin"
        | "tenant_admin"
        | "operator"
        | "viewer"
        | "manager"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: [
        "super_admin",
        "tenant_admin",
        "operator",
        "viewer",
        "manager",
      ],
    },
  },
} as const
