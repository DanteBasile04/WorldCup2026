export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Group = {
  id: number;
  name: string;
  slug: string;
};

export type Country = {
  id: number;
  name: string;
  federation: string | null;
  flag_url: string | null;
  emblem_url: string | null;
  colors: string | null;
  story: string | null;
  trophies: string | null;
  formation: string | null;
  slug: string;
};

export type GroupStanding = {
  id: number;
  group_id: number;
  country_id: number;
  matches_played: number | null;
  wins: number | null;
  draws: number | null;
  losses: number | null;
  goals_for: number | null;
  goals_against: number | null;
  points: number | null;
};

export type Match = {
  id: number;
  group_id: number | null;
  local_country_id: number | null;
  away_country_id: number | null;
  next_match_id: number | null;
  phase: "group" | "knockout";
  round:
    | "round_of_32"
    | "round_of_16"
    | "quarter_final"
    | "semi_final"
    | "third_place"
    | "final"
    | null;
  stage: string | null;
  stadium: string | null;
  date: string | null;
  local_score: number | null;
  away_score: number | null;
  status: "scheduled" | "live" | "finished";
};

export type Database = {
  public: {
    Tables: {
      grp: {
        Row: Group;
        Insert: never;
        Update: never;
        Relationships: [];
      };
      country: {
        Row: Country;
        Insert: never;
        Update: never;
        Relationships: [];
      };
      group_standing: {
        Row: GroupStanding;
        Insert: never;
        Update: never;
        Relationships: [];
      };
      match: {
        Row: Match;
        Insert: never;
        Update: never;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
