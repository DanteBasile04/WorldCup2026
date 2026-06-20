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
      country: {
        Row: {
          colors: string | null
          emblem_url: string | null
          emblem_storage_path: string | null
          federation: string | null
          flag_banner_storage_path: string | null
          flag_storage_path: string | null
          flag_url: string | null
          formation: string | null
          formation_json: Json | null
          id: number
          name: string
          slug: string
          story: string | null
          trophies: string | null
        }
        Insert: {
          colors?: string | null
          emblem_url?: string | null
          emblem_storage_path?: string | null
          federation?: string | null
          flag_banner_storage_path?: string | null
          flag_storage_path?: string | null
          flag_url?: string | null
          formation?: string | null
          formation_json?: Json | null
          id?: number
          name: string
          slug: string
          story?: string | null
          trophies?: string | null
        }
        Update: {
          colors?: string | null
          emblem_url?: string | null
          emblem_storage_path?: string | null
          federation?: string | null
          flag_banner_storage_path?: string | null
          flag_storage_path?: string | null
          flag_url?: string | null
          formation?: string | null
          formation_json?: Json | null
          id?: number
          name?: string
          slug?: string
          story?: string | null
          trophies?: string | null
        }
        Relationships: []
      }
      group_standing: {
        Row: {
          country_id: number
          draws: number | null
          goals_against: number | null
          goals_for: number | null
          group_id: number
          id: number
          losses: number | null
          matches_played: number | null
          points: number | null
          wins: number | null
        }
        Insert: {
          country_id: number
          draws?: number | null
          goals_against?: number | null
          goals_for?: number | null
          group_id: number
          id?: number
          losses?: number | null
          matches_played?: number | null
          points?: number | null
          wins?: number | null
        }
        Update: {
          country_id?: number
          draws?: number | null
          goals_against?: number | null
          goals_for?: number | null
          group_id?: number
          id?: number
          losses?: number | null
          matches_played?: number | null
          points?: number | null
          wins?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_group_standing_country"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "country"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_group_standing_group"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "grp"
            referencedColumns: ["id"]
          },
        ]
      }
      grp: {
        Row: {
          id: number
          name: string
          slug: string
        }
        Insert: {
          id?: number
          name: string
          slug: string
        }
        Update: {
          id?: number
          name?: string
          slug?: string
        }
        Relationships: []
      }
      match: {
        Row: {
          away_country_id: number | null
          away_score: number | null
          date: string | null
          group_id: number | null
          id: number
          local_country_id: number | null
          local_score: number | null
          next_match_id: number | null
          phase: string
          round: string | null
          stadium: string | null
          status: string
        }
        Insert: {
          away_country_id?: number | null
          away_score?: number | null
          date?: string | null
          group_id?: number | null
          id?: number
          local_country_id?: number | null
          local_score?: number | null
          next_match_id?: number | null
          phase?: string
          round?: string | null
          stadium?: string | null
          status?: string
        }
        Update: {
          away_country_id?: number | null
          away_score?: number | null
          date?: string | null
          group_id?: number | null
          id?: number
          local_country_id?: number | null
          local_score?: number | null
          next_match_id?: number | null
          phase?: string
          round?: string | null
          stadium?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_match_away_country"
            columns: ["away_country_id"]
            isOneToOne: false
            referencedRelation: "country"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_match_group"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "grp"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_match_local_country"
            columns: ["local_country_id"]
            isOneToOne: false
            referencedRelation: "country"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_match_next_match"
            columns: ["next_match_id"]
            isOneToOne: false
            referencedRelation: "match"
            referencedColumns: ["id"]
          },
        ]
      }
      player: {
        Row: {
          age: number | null
          country_id: number
          current_club: string | null
          height_cm: number | null
          id: number
          name: string
          position: string
          preferred_foot: string | null
          shirt_number: number | null
          weight_kg: number | null
        }
        Insert: {
          age?: number | null
          country_id: number
          current_club?: string | null
          height_cm?: number | null
          id?: number
          name: string
          position: string
          preferred_foot?: string | null
          shirt_number?: number | null
          weight_kg?: number | null
        }
        Update: {
          age?: number | null
          country_id?: number
          current_club?: string | null
          height_cm?: number | null
          id?: number
          name?: string
          position?: string
          preferred_foot?: string | null
          shirt_number?: number | null
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "player_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "country"
            referencedColumns: ["id"]
          },
        ]
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

// ---------------------------------------------------------------------------
// Convenience aliases — these allow `import type { Country }` etc.
// Replacer generators produce Tables<"country"> style; these aliases
// bridge to the short names used throughout the app. If you regenerate
// this file, keep these aliases at the bottom.
// ---------------------------------------------------------------------------
export type Country = Tables<"country">
export type CountryFormation = Tables<"country">["formation_json"]
export type Group = Tables<"grp">
export type GroupStanding = Tables<"group_standing">
export type Match = Tables<"match">
