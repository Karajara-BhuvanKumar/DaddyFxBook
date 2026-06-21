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
      ai_performance_reports: {
        Row: {
          created_at: string
          id: string
          report: Json
          stats: Json | null
          trade_count: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          report: Json
          stats?: Json | null
          trade_count?: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          report?: Json
          stats?: Json | null
          trade_count?: number
          user_id?: string
        }
        Relationships: []
      }
      ai_period_reports: {
        Row: {
          created_at: string
          id: string
          period_end: string
          period_start: string
          period_type: string
          report: Json
          stats: Json
          trade_count: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          period_end: string
          period_start: string
          period_type: string
          report: Json
          stats: Json
          trade_count?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          period_end?: string
          period_start?: string
          period_type?: string
          report?: Json
          stats?: Json
          trade_count?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_scorecards: {
        Row: {
          ai_insights: Json | null
          breakdown: Json
          classification: string
          consistency_score: number
          created_at: string
          discipline_score: number
          execution_score: number
          id: string
          overall_score: number
          psychology_score: number
          risk_score: number
          trade_count: number
          user_id: string
        }
        Insert: {
          ai_insights?: Json | null
          breakdown: Json
          classification?: string
          consistency_score?: number
          created_at?: string
          discipline_score?: number
          execution_score?: number
          id?: string
          overall_score?: number
          psychology_score?: number
          risk_score?: number
          trade_count?: number
          user_id: string
        }
        Update: {
          ai_insights?: Json | null
          breakdown?: Json
          classification?: string
          consistency_score?: number
          created_at?: string
          discipline_score?: number
          execution_score?: number
          id?: string
          overall_score?: number
          psychology_score?: number
          risk_score?: number
          trade_count?: number
          user_id?: string
        }
        Relationships: []
      }
      ai_trade_reviews: {
        Row: {
          created_at: string
          grade: string
          id: string
          improvements: string[]
          summary: string
          trade_id: string
          updated_at: string
          user_id: string
          went_right: string[]
          went_wrong: string[]
        }
        Insert: {
          created_at?: string
          grade: string
          id?: string
          improvements?: string[]
          summary?: string
          trade_id: string
          updated_at?: string
          user_id: string
          went_right?: string[]
          went_wrong?: string[]
        }
        Update: {
          created_at?: string
          grade?: string
          id?: string
          improvements?: string[]
          summary?: string
          trade_id?: string
          updated_at?: string
          user_id?: string
          went_right?: string[]
          went_wrong?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "ai_trade_reviews_trade_id_fkey"
            columns: ["trade_id"]
            isOneToOne: false
            referencedRelation: "trades"
            referencedColumns: ["id"]
          },
        ]
      }
      backtest_ai_reports: {
        Row: {
          created_at: string
          id: string
          metrics: Json
          patterns: Json
          scorecard: Json
          session_id: string
          strengths: Json
          suggestions: Json
          summary: string | null
          updated_at: string
          user_id: string
          weaknesses: Json
        }
        Insert: {
          created_at?: string
          id?: string
          metrics?: Json
          patterns?: Json
          scorecard?: Json
          session_id: string
          strengths?: Json
          suggestions?: Json
          summary?: string | null
          updated_at?: string
          user_id: string
          weaknesses?: Json
        }
        Update: {
          created_at?: string
          id?: string
          metrics?: Json
          patterns?: Json
          scorecard?: Json
          session_id?: string
          strengths?: Json
          suggestions?: Json
          summary?: string | null
          updated_at?: string
          user_id?: string
          weaknesses?: Json
        }
        Relationships: [
          {
            foreignKeyName: "backtest_ai_reports_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "backtest_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      backtest_sessions: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          pair: string | null
          strategy: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          pair?: string | null
          strategy?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          pair?: string | null
          strategy?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      backtest_trades: {
        Row: {
          created_at: string
          direction: string
          emotion: string | null
          entry_price: number | null
          exit_price: number | null
          id: string
          market_condition: string | null
          notes: string | null
          outcome: string
          pair: string
          pnl: number | null
          r_gained: number | null
          rr: number | null
          screenshot_url: string | null
          session: string | null
          session_id: string
          setup: string | null
          stop_loss: number | null
          take_profit: number | null
          trade_date: string | null
          trade_number: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          direction: string
          emotion?: string | null
          entry_price?: number | null
          exit_price?: number | null
          id?: string
          market_condition?: string | null
          notes?: string | null
          outcome: string
          pair: string
          pnl?: number | null
          r_gained?: number | null
          rr?: number | null
          screenshot_url?: string | null
          session?: string | null
          session_id: string
          setup?: string | null
          stop_loss?: number | null
          take_profit?: number | null
          trade_date?: string | null
          trade_number?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          direction?: string
          emotion?: string | null
          entry_price?: number | null
          exit_price?: number | null
          id?: string
          market_condition?: string | null
          notes?: string | null
          outcome?: string
          pair?: string
          pnl?: number | null
          r_gained?: number | null
          rr?: number | null
          screenshot_url?: string | null
          session?: string | null
          session_id?: string
          setup?: string | null
          stop_loss?: number | null
          take_profit?: number | null
          trade_date?: string | null
          trade_number?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "backtest_trades_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "backtest_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      checklists: {
        Row: {
          checked_higher_tf: boolean | null
          created_at: string
          fits_plan: boolean | null
          id: string
          key_levels: boolean | null
          news_checked: boolean | null
          risk_within_limits: boolean | null
          trade_id: string
          user_id: string
        }
        Insert: {
          checked_higher_tf?: boolean | null
          created_at?: string
          fits_plan?: boolean | null
          id?: string
          key_levels?: boolean | null
          news_checked?: boolean | null
          risk_within_limits?: boolean | null
          trade_id: string
          user_id: string
        }
        Update: {
          checked_higher_tf?: boolean | null
          created_at?: string
          fits_plan?: boolean | null
          id?: string
          key_levels?: boolean | null
          news_checked?: boolean | null
          risk_within_limits?: boolean | null
          trade_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklists_trade_id_fkey"
            columns: ["trade_id"]
            isOneToOne: true
            referencedRelation: "trades"
            referencedColumns: ["id"]
          },
        ]
      }
      journals: {
        Row: {
          created_at: string
          emotions: string | null
          id: string
          lessons: string | null
          post_trade_notes: string | null
          pre_trade_notes: string | null
          rating: number | null
          risk_reward: string | null
          tags: string | null
          trade_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emotions?: string | null
          id?: string
          lessons?: string | null
          post_trade_notes?: string | null
          pre_trade_notes?: string | null
          rating?: number | null
          risk_reward?: string | null
          tags?: string | null
          trade_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          emotions?: string | null
          id?: string
          lessons?: string | null
          post_trade_notes?: string | null
          pre_trade_notes?: string | null
          rating?: number | null
          risk_reward?: string | null
          tags?: string | null
          trade_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "journals_trade_id_fkey"
            columns: ["trade_id"]
            isOneToOne: true
            referencedRelation: "trades"
            referencedColumns: ["id"]
          },
        ]
      }
      screenshots: {
        Row: {
          created_at: string
          id: string
          image_url: string
          trade_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url: string
          trade_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string
          trade_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "screenshots_trade_id_fkey"
            columns: ["trade_id"]
            isOneToOne: false
            referencedRelation: "trades"
            referencedColumns: ["id"]
          },
        ]
      }
      trades: {
        Row: {
          close_time: string
          created_at: string
          direction: string
          entry_price: number
          exit_price: number
          id: string
          lot_size: number
          open_time: string
          pnl: number
          session: string | null
          source: string
          stop_loss: number | null
          symbol: string
          take_profit: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          close_time?: string
          created_at?: string
          direction: string
          entry_price: number
          exit_price: number
          id?: string
          lot_size?: number
          open_time?: string
          pnl?: number
          session?: string | null
          source?: string
          stop_loss?: number | null
          symbol?: string
          take_profit?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          close_time?: string
          created_at?: string
          direction?: string
          entry_price?: number
          exit_price?: number
          id?: string
          lot_size?: number
          open_time?: string
          pnl?: number
          session?: string | null
          source?: string
          stop_loss?: number | null
          symbol?: string
          take_profit?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      trading_rules: {
        Row: {
          active: boolean
          created_at: string
          id: string
          position: number
          rule: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          position?: number
          rule: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          position?: number
          rule?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          accent_color: string | null
          account_size: number | null
          avatar_url: string | null
          chart_style: string | null
          compact_mode: boolean | null
          created_at: string
          currency: string | null
          default_risk_pct: number | null
          display_name: string | null
          max_daily_risk: number | null
          max_trades_per_day: number | null
          max_weekly_risk: number | null
          notify_daily: boolean | null
          notify_monthly: boolean | null
          notify_news: boolean | null
          notify_weekly: boolean | null
          preferred_session: string | null
          theme: string | null
          time_format: string | null
          timezone: string | null
          updated_at: string
          user_id: string
          username: string | null
        }
        Insert: {
          accent_color?: string | null
          account_size?: number | null
          avatar_url?: string | null
          chart_style?: string | null
          compact_mode?: boolean | null
          created_at?: string
          currency?: string | null
          default_risk_pct?: number | null
          display_name?: string | null
          max_daily_risk?: number | null
          max_trades_per_day?: number | null
          max_weekly_risk?: number | null
          notify_daily?: boolean | null
          notify_monthly?: boolean | null
          notify_news?: boolean | null
          notify_weekly?: boolean | null
          preferred_session?: string | null
          theme?: string | null
          time_format?: string | null
          timezone?: string | null
          updated_at?: string
          user_id: string
          username?: string | null
        }
        Update: {
          accent_color?: string | null
          account_size?: number | null
          avatar_url?: string | null
          chart_style?: string | null
          compact_mode?: boolean | null
          created_at?: string
          currency?: string | null
          default_risk_pct?: number | null
          display_name?: string | null
          max_daily_risk?: number | null
          max_trades_per_day?: number | null
          max_weekly_risk?: number | null
          notify_daily?: boolean | null
          notify_monthly?: boolean | null
          notify_news?: boolean | null
          notify_weekly?: boolean | null
          preferred_session?: string | null
          theme?: string | null
          time_format?: string | null
          timezone?: string | null
          updated_at?: string
          user_id?: string
          username?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
