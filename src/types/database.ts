export interface Database {
  public: {
    Tables: {
      user_compounds: {
        Row: {
          id: string;
          user_id: string;
          compound_id: string;
          start_date: string;
          dose_amount_mcg: number;
          dose_frequency_hours: number;
          route: string;
          vial_strength_mg: number;
          water_volume_ml: number;
          color: string;
          active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          compound_id: string;
          start_date: string;
          dose_amount_mcg: number;
          dose_frequency_hours: number;
          route: string;
          vial_strength_mg?: number;
          water_volume_ml?: number;
          color: string;
          active?: boolean;
        };
        Update: {
          compound_id?: string;
          start_date?: string;
          dose_amount_mcg?: number;
          dose_frequency_hours?: number;
          route?: string;
          vial_strength_mg?: number;
          water_volume_ml?: number;
          color?: string;
          active?: boolean;
        };
      };
      dose_logs: {
        Row: {
          id: string;
          user_id: string;
          compound_id: string;
          user_compound_id: string;
          timestamp: string;
          dose_mcg: number;
          units: number;
          route: string;
          injection_site: string;
          notes: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          compound_id: string;
          user_compound_id: string;
          timestamp: string;
          dose_mcg: number;
          units?: number;
          route: string;
          injection_site?: string;
          notes?: string;
        };
        Update: {
          compound_id?: string;
          user_compound_id?: string;
          timestamp?: string;
          dose_mcg?: number;
          units?: number;
          route?: string;
          injection_site?: string;
          notes?: string;
        };
      };
      user_vials: {
        Row: {
          id: string;
          user_id: string;
          user_compound_id: string;
          compound_id: string;
          vial_strength_mg: number;
          water_volume_ml: number;
          opened_at: string;
          retired_at: string | null;
          active: boolean;
          notes: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          user_compound_id: string;
          compound_id: string;
          vial_strength_mg?: number;
          water_volume_ml?: number;
          opened_at: string;
          retired_at?: string | null;
          active?: boolean;
          notes?: string;
        };
        Update: {
          user_compound_id?: string;
          compound_id?: string;
          vial_strength_mg?: number;
          water_volume_ml?: number;
          opened_at?: string;
          retired_at?: string | null;
          active?: boolean;
          notes?: string;
        };
      };
    };
  };
}
