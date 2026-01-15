export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          pin_hash: string
          display_name: string | null
          theme: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          pin_hash: string
          display_name?: string | null
          theme?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          pin_hash?: string
          display_name?: string | null
          theme?: string
          created_at?: string
          updated_at?: string
        }
      }
      categories: {
        Row: {
          id: string
          user_id: string
          name: string
          percentage: number
          color: string
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          percentage: number
          color?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          percentage?: number
          color?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      budget_versions: {
        Row: {
          id: string
          user_id: string
          version_number: number
          name: string | null
          is_current: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          version_number?: number
          name?: string | null
          is_current?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          version_number?: number
          name?: string | null
          is_current?: boolean
          created_at?: string
        }
      }
      budget_version_categories: {
        Row: {
          id: string
          budget_version_id: string
          category_id: string
          percentage: number
        }
        Insert: {
          id?: string
          budget_version_id: string
          category_id: string
          percentage: number
        }
        Update: {
          id?: string
          budget_version_id?: string
          category_id?: string
          percentage?: number
        }
      }
      paychecks: {
        Row: {
          id: string
          user_id: string
          budget_version_id: string
          amount: number
          date: string
          frequency: 'weekly' | 'bi-weekly' | 'monthly' | 'quarterly'
          description: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          budget_version_id: string
          amount: number
          date: string
          frequency: 'weekly' | 'bi-weekly' | 'monthly' | 'quarterly'
          description?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          budget_version_id?: string
          amount?: number
          date?: string
          frequency?: 'weekly' | 'bi-weekly' | 'monthly' | 'quarterly'
          description?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      allocations: {
        Row: {
          id: string
          paycheck_id: string
          category_id: string
          budgeted_amount: number
          spent_amount: number
        }
        Insert: {
          id?: string
          paycheck_id: string
          category_id: string
          budgeted_amount: number
          spent_amount?: number
        }
        Update: {
          id?: string
          paycheck_id?: string
          category_id?: string
          budgeted_amount?: number
          spent_amount?: number
        }
      }
      transactions: {
        Row: {
          id: string;
          user_id: string;
          category_id: string;
          amount: number;
          date: string;
          description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          category_id: string;
          amount: number;
          date?: string;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          category_id?: string;
          amount?: number;
          date?: string;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      paycheck_frequency: 'weekly' | 'bi-weekly' | 'monthly' | 'quarterly'
    }
  }
}
