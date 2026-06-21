
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      user_settings: {
        Row: {
          user_id: string
          display_name: string | null
          username: string | null
          avatar_url: string | null
          timezone: string | null
          time_format: string | null
          currency: string | null
          account_size: number | null
          default_risk_pct: number | null
          max_daily_risk: number | null
          max_weekly_risk: number | null
          max_trades_per_day: number | null
          preferred_session: string | null
          theme: string | null
          accent_color: string | null
          chart_style: string | null
          compact_mode: boolean | null
          notify_daily: boolean | null
          notify_weekly: boolean | null
          notify_monthly: boolean | null
          notify_news: boolean | null
          gemini_api_key: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          display_name?: string | null
          username?: string | null
          avatar_url?: string | null
          timezone?: string | null
          time_format?: string | null
          currency?: string | null
          account_size?: number | null
          default_risk_pct?: number | null
          max_daily_risk?: number | null
          max_weekly_risk?: number | null
          max_trades_per_day?: number | null
          preferred_session?: string | null
          theme?: string | null
          accent_color?: string | null
          chart_style?: string | null
          compact_mode?: boolean | null
          notify_daily?: boolean | null
          notify_weekly?: boolean | null
          notify_monthly?: boolean | null
          notify_news?: boolean | null
          gemini_api_key?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          display_name?: string | null
          username?: string | null
          avatar_url?: string | null
          timezone?: string | null
          time_format?: string | null
          currency?: string | null
          account_size?: number | null
          default_risk_pct?: number | null
          max_daily_risk?: number | null
          max_weekly_risk?: number | null
          max_trades_per_day?: number | null
          preferred_session?: string | null
          theme?: string | null
          accent_color?: string | null
          chart_style?: string | null
          compact_mode?: boolean | null
          notify_daily?: boolean | null
          notify_weekly?: boolean | null
          notify_monthly?: boolean | null
          notify_news?: boolean | null
          gemini_api_key?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      trading_rules: {
        Row: {
          id: string
          user_id: string
          rule: string
          active: boolean
          position: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          rule: string
          active?: boolean
          position?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          rule?: string
          active?: boolean
          position?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      trades: {
        Row: {
          id: string
          user_id: string
          symbol: string
          direction: string
          entry_price: number
          exit_price: number
          lot_size: number
          stop_loss: number | null
          take_profit: number | null
          pnl: number
          open_time: string
          close_time: string
          session: string | null
          source: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          symbol?: string
          direction: string
          entry_price: number
          exit_price: number
          lot_size?: number
          stop_loss?: number | null
          take_profit?: number | null
          pnl?: number
          open_time?: string
          close_time?: string
          session?: string | null
          source?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          symbol?: string
          direction?: string
          entry_price?: number
          exit_price?: number
          lot_size?: number
          stop_loss?: number | null
          take_profit?: number | null
          pnl?: number
          open_time?: string
          close_time?: string
          session?: string | null
          source?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      journals: {
        Row: {
          id: string
          trade_id: string
          user_id: string
          pre_trade_notes: string | null
          post_trade_notes: string | null
          emotions: string | null
          lessons: string | null
          tags: string | null
          rating: number | null
          risk_reward: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          trade_id: string
          user_id: string
          pre_trade_notes?: string | null
          post_trade_notes?: string | null
          emotions?: string | null
          lessons?: string | null
          tags?: string | null
          rating?: number | null
          risk_reward?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          trade_id?: string
          user_id?: string
          pre_trade_notes?: string | null
          post_trade_notes?: string | null
          emotions?: string | null
          lessons?: string | null
          tags?: string | null
          rating?: number | null
          risk_reward?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      checklists: {
        Row: {
          id: string
          trade_id: string
          user_id: string
          checked_higher_tf: boolean | null
          risk_within_limits: boolean | null
          fits_plan: boolean | null
          key_levels: boolean | null
          news_checked: boolean | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          trade_id: string
          user_id: string
          checked_higher_tf?: boolean | null
          risk_within_limits?: boolean | null
          fits_plan?: boolean | null
          key_levels?: boolean | null
          news_checked?: boolean | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          trade_id?: string
          user_id?: string
          checked_higher_tf?: boolean | null
          risk_within_limits?: boolean | null
          fits_plan?: boolean | null
          key_levels?: boolean | null
          news_checked?: boolean | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      screenshots: {
        Row: {
          id: string
          trade_id: string
          user_id: string
          image_url: string
          created_at: string
        }
        Insert: {
          id?: string
          trade_id: string
          user_id: string
          image_url: string
          created_at?: string
        }
        Update: {
          id?: string
          trade_id?: string
          user_id?: string
          image_url?: string
          created_at?: string
        }
        Relationships: []
      }
      backtest_sessions: {
        Row: {
          id: string
          user_id: string
          name: string
          pair: string | null
          strategy: string | null
          description: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          pair?: string | null
          strategy?: string | null
          description?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          pair?: string | null
          strategy?: string | null
          description?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      backtest_trades: {
        Row: {
          id: string
          user_id: string
          session_id: string
          trade_number: number | null
          pair: string
          direction: string
          entry_price: number | null
          stop_loss: number | null
          take_profit: number | null
          exit_price: number | null
          rr: number | null
          r_gained: number | null
          pnl: number | null
          outcome: string
          setup: string | null
          session: string | null
          market_condition: string | null
          emotion: string | null
          notes: string | null
          screenshot_url: string | null
          trade_date: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          session_id: string
          trade_number?: number | null
          pair: string
          direction: string
          entry_price?: number | null
          stop_loss?: number | null
          take_profit?: number | null
          exit_price?: number | null
          rr?: number | null
          r_gained?: number | null
          pnl?: number | null
          outcome: string
          setup?: string | null
          session?: string | null
          market_condition?: string | null
          emotion?: string | null
          notes?: string | null
          screenshot_url?: string | null
          trade_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          session_id?: string
          trade_number?: number | null
          pair?: string
          direction?: string
          entry_price?: number | null
          stop_loss?: number | null
          take_profit?: number | null
          exit_price?: number | null
          rr?: number | null
          r_gained?: number | null
          pnl?: number | null
          outcome?: string
          setup?: string | null
          session?: string | null
          market_condition?: string | null
          emotion?: string | null
          notes?: string | null
          screenshot_url?: string | null
          trade_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {}
    Functions: {}
    Enums: {}
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
