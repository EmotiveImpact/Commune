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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      activity_log: {
        Row: {
          action: string
          created_at: string
          entity_id: string | null
          entity_type: string | null
          group_id: string
          id: string
          metadata: Json
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          group_id: string
          id?: string
          metadata?: Json
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          group_id?: string
          id?: string
          metadata?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      chore_completions: {
        Row: {
          chore_id: string
          completed_at: string
          completed_by: string
          id: string
        }
        Insert: {
          chore_id: string
          completed_at?: string
          completed_by: string
          id?: string
        }
        Update: {
          chore_id?: string
          completed_at?: string
          completed_by?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chore_completions_chore_id_fkey"
            columns: ["chore_id"]
            isOneToOne: false
            referencedRelation: "chores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chore_completions_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      chores: {
        Row: {
          assigned_to: string | null
          category: string
          checklist_items: Json | null
          created_at: string
          created_by: string
          description: string | null
          escalation_days: number | null
          frequency: string
          group_id: string
          id: string
          is_active: boolean
          next_due: string
          rotation_order: Json | null
          task_type: string
          title: string
        }
        Insert: {
          assigned_to?: string | null
          category?: string
          checklist_items?: Json | null
          created_at?: string
          created_by: string
          description?: string | null
          escalation_days?: number | null
          frequency?: string
          group_id: string
          id?: string
          is_active?: boolean
          next_due?: string
          rotation_order?: Json | null
          task_type?: string
          title: string
        }
        Update: {
          assigned_to?: string | null
          category?: string
          checklist_items?: Json | null
          created_at?: string
          created_by?: string
          description?: string | null
          escalation_days?: number | null
          frequency?: string
          group_id?: string
          id?: string
          is_active?: boolean
          next_due?: string
          rotation_order?: Json | null
          task_type?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "chores_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chores_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chores_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_participants: {
        Row: {
          created_at: string
          expense_id: string
          id: string
          share_amount: number
          share_percentage: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          expense_id: string
          id?: string
          share_amount: number
          share_percentage?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          expense_id?: string
          id?: string
          share_amount?: number
          share_percentage?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_participants_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          category: Database["public"]["Enums"]["expense_category"]
          created_at: string
          created_by: string
          currency: string
          description: string | null
          due_date: string
          flagged_at: string | null
          flagged_by: string[] | null
          flagged_reason: string | null
          group_id: string
          id: string
          invoice_date: string | null
          invoice_reference: string | null
          is_active: boolean
          paid_by_user_id: string | null
          payment_due_date: string | null
          receipt_url: string | null
          recurrence_interval: number
          recurrence_type: Database["public"]["Enums"]["recurrence_type"]
          split_method: Database["public"]["Enums"]["split_method"]
          title: string
          updated_at: string
          vendor_name: string | null
        }
        Insert: {
          amount: number
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          category: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          created_by: string
          currency?: string
          description?: string | null
          due_date: string
          flagged_at?: string | null
          flagged_by?: string[] | null
          flagged_reason?: string | null
          group_id: string
          id?: string
          invoice_date?: string | null
          invoice_reference?: string | null
          is_active?: boolean
          paid_by_user_id?: string | null
          payment_due_date?: string | null
          receipt_url?: string | null
          recurrence_interval?: number
          recurrence_type?: Database["public"]["Enums"]["recurrence_type"]
          split_method?: Database["public"]["Enums"]["split_method"]
          title: string
          updated_at?: string
          vendor_name?: string | null
        }
        Update: {
          amount?: number
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          category?: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          created_by?: string
          currency?: string
          description?: string | null
          due_date?: string
          flagged_at?: string | null
          flagged_by?: string[] | null
          flagged_reason?: string | null
          group_id?: string
          id?: string
          invoice_date?: string | null
          invoice_reference?: string | null
          is_active?: boolean
          paid_by_user_id?: string | null
          payment_due_date?: string | null
          receipt_url?: string | null
          recurrence_interval?: number
          recurrence_type?: Database["public"]["Enums"]["recurrence_type"]
          split_method?: Database["public"]["Enums"]["split_method"]
          title?: string
          updated_at?: string
          vendor_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_paid_by_user_id_fkey"
            columns: ["paid_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      fund_contributions: {
        Row: {
          amount: number
          contributed_at: string
          fund_id: string
          id: string
          note: string | null
          user_id: string
        }
        Insert: {
          amount: number
          contributed_at?: string
          fund_id: string
          id?: string
          note?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          contributed_at?: string
          fund_id?: string
          id?: string
          note?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fund_contributions_fund_id_fkey"
            columns: ["fund_id"]
            isOneToOne: false
            referencedRelation: "group_funds"
            referencedColumns: ["id"]
          },
        ]
      }
      fund_expenses: {
        Row: {
          amount: number
          description: string
          fund_id: string
          id: string
          receipt_url: string | null
          spent_at: string
          spent_by: string
        }
        Insert: {
          amount: number
          description: string
          fund_id: string
          id?: string
          receipt_url?: string | null
          spent_at?: string
          spent_by: string
        }
        Update: {
          amount?: number
          description?: string
          fund_id?: string
          id?: string
          receipt_url?: string | null
          spent_at?: string
          spent_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "fund_expenses_fund_id_fkey"
            columns: ["fund_id"]
            isOneToOne: false
            referencedRelation: "group_funds"
            referencedColumns: ["id"]
          },
        ]
      }
      group_budgets: {
        Row: {
          alert_threshold: number
          budget_amount: number
          category_budgets: Json | null
          created_at: string
          created_by: string
          currency: string
          group_id: string
          id: string
          month: string
          updated_at: string
        }
        Insert: {
          alert_threshold?: number
          budget_amount: number
          category_budgets?: Json | null
          created_at?: string
          created_by: string
          currency?: string
          group_id: string
          id?: string
          month: string
          updated_at?: string
        }
        Update: {
          alert_threshold?: number
          budget_amount?: number
          category_budgets?: Json | null
          created_at?: string
          created_by?: string
          currency?: string
          group_id?: string
          id?: string
          month?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_budgets_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_cycle_closures: {
        Row: {
          closed_at: string
          closed_by: string
          created_at: string
          cycle_end: string
          cycle_start: string
          group_id: string
          id: string
          notes: string | null
          reopened_at: string | null
          reopened_by: string | null
          updated_at: string
        }
        Insert: {
          closed_at?: string
          closed_by: string
          created_at?: string
          cycle_end: string
          cycle_start: string
          group_id: string
          id?: string
          notes?: string | null
          reopened_at?: string | null
          reopened_by?: string | null
          updated_at?: string
        }
        Update: {
          closed_at?: string
          closed_by?: string
          created_at?: string
          cycle_end?: string
          cycle_start?: string
          group_id?: string
          id?: string
          notes?: string | null
          reopened_at?: string | null
          reopened_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_cycle_closures_closed_by_fkey"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_cycle_closures_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_cycle_closures_reopened_by_fkey"
            columns: ["reopened_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      group_funds: {
        Row: {
          created_at: string
          created_by: string
          currency: string
          group_id: string
          id: string
          name: string
          target_amount: number | null
        }
        Insert: {
          created_at?: string
          created_by: string
          currency: string
          group_id: string
          id?: string
          name: string
          target_amount?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string
          currency?: string
          group_id?: string
          id?: string
          name?: string
          target_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "group_funds_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_invites: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          group_id: string
          id: string
          invited_by: string
          status: string
          token: string
        }
        Insert: {
          created_at?: string
          email: string
          expires_at?: string
          group_id: string
          id?: string
          invited_by: string
          status?: string
          token: string
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          group_id?: string
          id?: string
          invited_by?: string
          status?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_invites_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_invites_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      group_members: {
        Row: {
          effective_from: string | null
          effective_until: string | null
          group_id: string
          id: string
          joined_at: string
          linked_partner_id: string | null
          responsibility_label: string | null
          role: Database["public"]["Enums"]["member_role"]
          status: Database["public"]["Enums"]["member_status"]
          user_id: string
        }
        Insert: {
          effective_from?: string | null
          effective_until?: string | null
          group_id: string
          id?: string
          joined_at?: string
          linked_partner_id?: string | null
          responsibility_label?: string | null
          role?: Database["public"]["Enums"]["member_role"]
          status?: Database["public"]["Enums"]["member_status"]
          user_id: string
        }
        Update: {
          effective_from?: string | null
          effective_until?: string | null
          group_id?: string
          id?: string
          joined_at?: string
          linked_partner_id?: string | null
          responsibility_label?: string | null
          role?: Database["public"]["Enums"]["member_role"]
          status?: Database["public"]["Enums"]["member_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_linked_partner_id_fkey"
            columns: ["linked_partner_id"]
            isOneToOne: false
            referencedRelation: "group_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      group_memories: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          group_id: string
          id: string
          memory_date: string | null
          photo_url: string | null
          title: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          group_id: string
          id?: string
          memory_date?: string | null
          photo_url?: string | null
          title: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          group_id?: string
          id?: string
          memory_date?: string | null
          photo_url?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_memories_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_memories_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          approval_policy: Json | null
          approval_threshold: number | null
          avatar_url: string | null
          cover_url: string | null
          created_at: string
          currency: string
          cycle_date: number
          description: string | null
          house_info: Json | null
          id: string
          name: string
          nudges_enabled: boolean
          owner_id: string
          pinned_message: string | null
          setup_checklist_progress: Json
          space_essentials: Json | null
          subtype: string | null
          tagline: string | null
          type: Database["public"]["Enums"]["group_type"]
        }
        Insert: {
          approval_policy?: Json | null
          approval_threshold?: number | null
          avatar_url?: string | null
          cover_url?: string | null
          created_at?: string
          currency?: string
          cycle_date?: number
          description?: string | null
          house_info?: Json | null
          id?: string
          name: string
          nudges_enabled?: boolean
          owner_id: string
          pinned_message?: string | null
          setup_checklist_progress?: Json
          space_essentials?: Json | null
          subtype?: string | null
          tagline?: string | null
          type: Database["public"]["Enums"]["group_type"]
        }
        Update: {
          approval_policy?: Json | null
          approval_threshold?: number | null
          avatar_url?: string | null
          cover_url?: string | null
          created_at?: string
          currency?: string
          cycle_date?: number
          description?: string | null
          house_info?: Json | null
          id?: string
          name?: string
          nudges_enabled?: boolean
          owner_id?: string
          pinned_message?: string | null
          setup_checklist_progress?: Json
          space_essentials?: Json | null
          subtype?: string | null
          tagline?: string | null
          type?: Database["public"]["Enums"]["group_type"]
        }
        Relationships: [
          {
            foreignKeyName: "groups_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_reads: {
        Row: {
          id: string
          notification_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          id?: string
          notification_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          id?: string
          notification_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: []
      }
      payment_nudges: {
        Row: {
          amount: number
          created_at: string
          expense_id: string | null
          from_user_id: string
          group_id: string
          id: string
          sent_at: string
          to_user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          expense_id?: string | null
          from_user_id: string
          group_id: string
          id?: string
          sent_at?: string
          to_user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          expense_id?: string | null
          from_user_id?: string
          group_id?: string
          id?: string
          sent_at?: string
          to_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_nudges_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_nudges_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_records: {
        Row: {
          amount: number
          confirmed_by: string | null
          created_at: string
          expense_id: string
          id: string
          note: string | null
          paid_at: string | null
          status: Database["public"]["Enums"]["payment_status"]
          user_id: string
        }
        Insert: {
          amount: number
          confirmed_by?: string | null
          created_at?: string
          expense_id: string
          id?: string
          note?: string | null
          paid_at?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          user_id: string
        }
        Update: {
          amount?: number
          confirmed_by?: string | null
          created_at?: string
          expense_id?: string
          id?: string
          note?: string | null
          paid_at?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_records_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_records_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_records_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_reminder_log: {
        Row: {
          id: string
          payment_record_id: string
          reminder_type: string
          sent_at: string
        }
        Insert: {
          id?: string
          payment_record_id: string
          reminder_type: string
          sent_at?: string
        }
        Update: {
          id?: string
          payment_record_id?: string
          reminder_type?: string
          sent_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_reminder_log_payment_record_id_fkey"
            columns: ["payment_record_id"]
            isOneToOne: false
            referencedRelation: "payment_records"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_expense_log: {
        Row: {
          created_at: string
          generated_expense_id: string
          generated_for_month: string
          id: string
          source_expense_id: string
        }
        Insert: {
          created_at?: string
          generated_expense_id: string
          generated_for_month: string
          id?: string
          source_expense_id: string
        }
        Update: {
          created_at?: string
          generated_expense_id?: string
          generated_for_month?: string
          id?: string
          source_expense_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_expense_log_generated_expense_id_fkey"
            columns: ["generated_expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_expense_log_source_expense_id_fkey"
            columns: ["source_expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
        ]
      }
      split_templates: {
        Row: {
          created_at: string
          created_by: string
          group_id: string
          id: string
          name: string
          participants: Json
          split_method: Database["public"]["Enums"]["split_method"]
        }
        Insert: {
          created_at?: string
          created_by: string
          group_id: string
          id?: string
          name: string
          participants?: Json
          split_method?: Database["public"]["Enums"]["split_method"]
        }
        Update: {
          created_at?: string
          created_by?: string
          group_id?: string
          id?: string
          name?: string
          participants?: Json
          split_method?: Database["public"]["Enums"]["split_method"]
        }
        Relationships: [
          {
            foreignKeyName: "split_templates_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          created_at: string
          current_period_end: string
          current_period_start: string
          id: string
          plan: Database["public"]["Enums"]["subscription_plan"]
          receipt_scan_count: number
          receipt_scan_reset_at: string | null
          status: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          trial_ends_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_period_end: string
          current_period_start: string
          id?: string
          plan?: Database["public"]["Enums"]["subscription_plan"]
          receipt_scan_count?: number
          receipt_scan_reset_at?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_ends_at: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_period_end?: string
          current_period_start?: string
          id?: string
          plan?: Database["public"]["Enums"]["subscription_plan"]
          receipt_scan_count?: number
          receipt_scan_reset_at?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_ends_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_payment_methods: {
        Row: {
          created_at: string
          id: string
          is_default: boolean
          label: string | null
          payment_info: string | null
          payment_link: string | null
          provider: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string | null
          payment_info?: string | null
          payment_link?: string | null
          provider: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string | null
          payment_info?: string | null
          payment_link?: string | null
          provider?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_payment_methods_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          avatar_url: string | null
          country: string | null
          created_at: string
          default_currency: string
          deletion_requested_at: string | null
          deletion_scheduled_for: string | null
          email: string
          first_name: string
          id: string
          is_deactivated: boolean
          last_name: string
          name: string | null
          notification_preferences: Json
          phone: string | null
          show_shared_groups: boolean
          timezone: string
        }
        Insert: {
          avatar_url?: string | null
          country?: string | null
          created_at?: string
          default_currency?: string
          deletion_requested_at?: string | null
          deletion_scheduled_for?: string | null
          email: string
          first_name?: string
          id: string
          is_deactivated?: boolean
          last_name?: string
          name?: string | null
          notification_preferences?: Json
          phone?: string | null
          show_shared_groups?: boolean
          timezone?: string
        }
        Update: {
          avatar_url?: string | null
          country?: string | null
          created_at?: string
          default_currency?: string
          deletion_requested_at?: string | null
          deletion_scheduled_for?: string | null
          email?: string
          first_name?: string
          id?: string
          is_deactivated?: boolean
          last_name?: string
          name?: string | null
          notification_preferences?: Json
          phone?: string | null
          show_shared_groups?: boolean
          timezone?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_group_invite: {
        Args: { target_group_id: string }
        Returns: {
          effective_from: string | null
          effective_until: string | null
          group_id: string
          id: string
          joined_at: string
          linked_partner_id: string | null
          responsibility_label: string | null
          role: Database["public"]["Enums"]["member_role"]
          status: Database["public"]["Enums"]["member_status"]
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "group_members"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      accept_invite_by_token: {
        Args: { p_token: string }
        Returns: {
          effective_from: string | null
          effective_until: string | null
          group_id: string
          id: string
          joined_at: string
          linked_partner_id: string | null
          responsibility_label: string | null
          role: Database["public"]["Enums"]["member_role"]
          status: Database["public"]["Enums"]["member_status"]
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "group_members"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      fn_get_activity_feed: {
        Args: {
          p_entity_types?: string[]
          p_group_id: string
          p_limit?: number
          p_offset?: number
        }
        Returns: Json
      }
      fn_get_cross_group_settlement_rollup: {
        Args: { p_user_id: string }
        Returns: Json
      }
      fn_get_dashboard_summary: {
        Args: {
          p_group_id: string
          p_include_insights?: boolean
          p_month: string
        }
        Returns: Json
      }
      fn_get_effective_plan: {
        Args: { p_user_id: string }
        Returns: Database["public"]["Enums"]["subscription_plan"]
      }
      fn_get_expense_ledger: {
        Args: {
          p_category?: string
          p_date_from?: string
          p_date_to?: string
          p_group_id: string
          p_include_all?: boolean
          p_is_workspace_group?: boolean
          p_month?: string
          p_page?: number
          p_page_size?: number
          p_search?: string
          p_status?: string
          p_workspace_view?: string
        }
        Returns: Json
      }
      fn_get_group_notifications: {
        Args: { p_cutoff_days?: number; p_group_id: string; p_limit?: number }
        Returns: Json
      }
      fn_get_group_notification_summary: {
        Args: { p_cutoff_days?: number; p_group_id: string; p_limit?: number }
        Returns: Json
      }
      fn_get_signed_in_bootstrap: {
        Args: {
          p_active_group_id?: string
          p_month?: string
          p_include_dashboard_summary?: boolean
          p_include_subscription?: boolean
        }
        Returns: Json
      }
      fn_get_user_group_summaries: {
        Args: Record<PropertyKey, never>
        Returns: {
          active_member_count: number
          approval_policy: Json
          avatar_url: string | null
          currency: string
          current_user_responsibility_label: string | null
          current_user_role: string
          id: string
          name: string
          subtype: string | null
          type: string
        }[]
      }
      fn_has_pending_recurring_generation: {
        Args: { p_group_id: string; p_month?: string }
        Returns: boolean
      }
      fn_get_group_settlement_rollup: {
        Args: { p_group_id: string; p_month?: string }
        Returns: Json
      }
      fn_get_smart_nudge_payload: {
        Args: { p_due_soon_days?: number }
        Returns: Json
      }
      fn_plan_group_limit: {
        Args: { p_plan: Database["public"]["Enums"]["subscription_plan"] }
        Returns: number
      }
      fn_plan_member_limit: {
        Args: { p_plan: Database["public"]["Enums"]["subscription_plan"] }
        Returns: number
      }
      fn_transfer_group_ownership: {
        Args: { p_group_id: string; p_new_owner_id: string }
        Returns: undefined
      }
      hard_delete_expired_accounts: { Args: never; Returns: number }
      invite_group_member: {
        Args: { target_email: string; target_group_id: string }
        Returns: Json
      }
      is_group_admin: {
        Args: { target_group_id: string; target_user_id?: string }
        Returns: boolean
      }
      is_group_member: {
        Args: { target_group_id: string; target_user_id?: string }
        Returns: boolean
      }
      reactivate_account: { Args: never; Returns: undefined }
      shares_group_with: {
        Args: { current_user_id?: string; target_user_id: string }
        Returns: boolean
      }
      soft_delete_account: { Args: never; Returns: undefined }
      validate_invite_token: {
        Args: { p_token: string }
        Returns: {
          email: string
          expires_at: string
          group_id: string
          group_name: string
          invite_id: string
          invited_by_name: string
          status: string
        }[]
      }
    }
    Enums: {
      expense_category:
        | "rent"
        | "utilities"
        | "internet"
        | "cleaning"
        | "groceries"
        | "entertainment"
        | "household_supplies"
        | "transport"
        | "work_tools"
        | "miscellaneous"
      group_type: "home" | "couple" | "workspace" | "project" | "trip" | "other"
      member_role: "admin" | "member"
      member_status: "invited" | "active" | "inactive" | "removed"
      payment_status: "unpaid" | "paid" | "confirmed"
      recurrence_type: "none" | "weekly" | "monthly"
      split_method: "equal" | "percentage" | "custom"
      subscription_plan: "standard" | "pro" | "agency" | "free"
      subscription_status: "trialing" | "active" | "past_due" | "cancelled"
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
      expense_category: [
        "rent",
        "utilities",
        "internet",
        "cleaning",
        "groceries",
        "entertainment",
        "household_supplies",
        "transport",
        "work_tools",
        "miscellaneous",
      ],
      group_type: ["home", "couple", "workspace", "project", "trip", "other"],
      member_role: ["admin", "member"],
      member_status: ["invited", "active", "inactive", "removed"],
      payment_status: ["unpaid", "paid", "confirmed"],
      recurrence_type: ["none", "weekly", "monthly"],
      split_method: ["equal", "percentage", "custom"],
      subscription_plan: ["standard", "pro", "agency", "free"],
      subscription_status: ["trialing", "active", "past_due", "cancelled"],
    },
  },
} as const
