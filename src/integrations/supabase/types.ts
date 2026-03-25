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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      ai_knowledge_base: {
        Row: {
          category: string
          content: string
          created_at: string
          file_url: string | null
          id: string
          is_active: boolean
          title: string
          updated_at: string
        }
        Insert: {
          category?: string
          content: string
          created_at?: string
          file_url?: string | null
          id?: string
          is_active?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          content?: string
          created_at?: string
          file_url?: string | null
          id?: string
          is_active?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      ai_pricing_config: {
        Row: {
          id: string
          max_tokens_detalhado: number
          max_tokens_economico: number
          max_tokens_ultra_economico: number
          model_name: string
          monthly_cap_brl: number
          price_in_per_1k: number
          price_out_per_1k: number
          rate_limit_per_5min: number
          rate_limit_per_day: number
          system_prompt: string
          updated_at: string
          usd_brl_rate: number
        }
        Insert: {
          id?: string
          max_tokens_detalhado?: number
          max_tokens_economico?: number
          max_tokens_ultra_economico?: number
          model_name?: string
          monthly_cap_brl?: number
          price_in_per_1k?: number
          price_out_per_1k?: number
          rate_limit_per_5min?: number
          rate_limit_per_day?: number
          system_prompt?: string
          updated_at?: string
          usd_brl_rate?: number
        }
        Update: {
          id?: string
          max_tokens_detalhado?: number
          max_tokens_economico?: number
          max_tokens_ultra_economico?: number
          model_name?: string
          monthly_cap_brl?: number
          price_in_per_1k?: number
          price_out_per_1k?: number
          rate_limit_per_5min?: number
          rate_limit_per_day?: number
          system_prompt?: string
          updated_at?: string
          usd_brl_rate?: number
        }
        Relationships: []
      }
      analytics_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          metadata: Json | null
          page: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json | null
          page?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          page?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      aulas: {
        Row: {
          created_at: string
          curso_id: string
          descricao: string | null
          duracao_segundos: number
          embed_html: string | null
          embed_url: string | null
          id: string
          is_published: boolean
          panda_quiz_id: string | null
          panda_video_id: string | null
          sort_order: number
          status: string
          thumbnail_url: string | null
          titulo: string
          titulo_normalizado: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          curso_id: string
          descricao?: string | null
          duracao_segundos?: number
          embed_html?: string | null
          embed_url?: string | null
          id?: string
          is_published?: boolean
          panda_quiz_id?: string | null
          panda_video_id?: string | null
          sort_order?: number
          status?: string
          thumbnail_url?: string | null
          titulo: string
          titulo_normalizado?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          curso_id?: string
          descricao?: string | null
          duracao_segundos?: number
          embed_html?: string | null
          embed_url?: string | null
          id?: string
          is_published?: boolean
          panda_quiz_id?: string | null
          panda_video_id?: string | null
          sort_order?: number
          status?: string
          thumbnail_url?: string | null
          titulo?: string
          titulo_normalizado?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "aulas_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "cursos"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_feedback: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          message_id: string
          rating: number | null
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          message_id: string
          rating?: number | null
          user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          message_id?: string
          rating?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_feedback_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_feedback_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          content: string
          cost_brl: number | null
          cost_usd: number | null
          created_at: string
          id: string
          mode: string | null
          role: string
          session_id: string
          tokens_in: number | null
          tokens_out: number | null
        }
        Insert: {
          content: string
          cost_brl?: number | null
          cost_usd?: number | null
          created_at?: string
          id?: string
          mode?: string | null
          role: string
          session_id: string
          tokens_in?: number | null
          tokens_out?: number | null
        }
        Update: {
          content?: string
          cost_brl?: number | null
          cost_usd?: number | null
          created_at?: string
          id?: string
          mode?: string | null
          role?: string
          session_id?: string
          tokens_in?: number | null
          tokens_out?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_sessions: {
        Row: {
          created_at: string
          id: string
          summary: string | null
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          summary?: string | null
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          summary?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      cursos: {
        Row: {
          capa_url: string | null
          created_at: string
          descricao: string | null
          id: string
          is_published: boolean
          nivel: string
          panda_folder_id: string | null
          sort_order: number
          tipo: string
          titulo: string
          titulo_normalizado: string | null
          updated_at: string
        }
        Insert: {
          capa_url?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          is_published?: boolean
          nivel?: string
          panda_folder_id?: string | null
          sort_order?: number
          tipo?: string
          titulo: string
          titulo_normalizado?: string | null
          updated_at?: string
        }
        Update: {
          capa_url?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          is_published?: boolean
          nivel?: string
          panda_folder_id?: string | null
          sort_order?: number
          tipo?: string
          titulo?: string
          titulo_normalizado?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      downloads: {
        Row: {
          aula_id: string
          created_at: string
          curso_id: string
          expires_at: string | null
          id: string
          panda_download_url: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          aula_id: string
          created_at?: string
          curso_id: string
          expires_at?: string | null
          id?: string
          panda_download_url?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          aula_id?: string
          created_at?: string
          curso_id?: string
          expires_at?: string | null
          id?: string
          panda_download_url?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "downloads_aula_id_fkey"
            columns: ["aula_id"]
            isOneToOne: false
            referencedRelation: "aulas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "downloads_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "cursos"
            referencedColumns: ["id"]
          },
        ]
      }
      home_banners: {
        Row: {
          created_at: string
          id: string
          image_url: string
          is_active: boolean
          link_url: string | null
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          image_url: string
          is_active?: boolean
          link_url?: string | null
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string
          is_active?: boolean
          link_url?: string | null
          sort_order?: number
        }
        Relationships: []
      }
      matriculas: {
        Row: {
          completed_at: string | null
          created_at: string
          curso_id: string
          id: string
          progresso_pct: number
          started_at: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          curso_id: string
          id?: string
          progresso_pct?: number
          started_at?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          curso_id?: string
          id?: string
          progresso_pct?: number
          started_at?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "matriculas_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "cursos"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          created_at: string
          ended_at: string | null
          external_id: string | null
          gdb: boolean
          id: string
          membership_type: string
          source: string
          started_at: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          ended_at?: string | null
          external_id?: string | null
          gdb?: boolean
          id?: string
          membership_type?: string
          source?: string
          started_at?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          ended_at?: string | null
          external_id?: string | null
          gdb?: boolean
          id?: string
          membership_type?: string
          source?: string
          started_at?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      partners: {
        Row: {
          category: string
          conditions: string | null
          contact_info: string | null
          coupon_code: string | null
          created_at: string
          discount: string | null
          id: string
          is_active: boolean
          logo_url: string | null
          name: string
          updated_at: string
          website_url: string | null
        }
        Insert: {
          category?: string
          conditions?: string | null
          contact_info?: string | null
          coupon_code?: string | null
          created_at?: string
          discount?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name: string
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          category?: string
          conditions?: string | null
          contact_info?: string | null
          coupon_code?: string | null
          created_at?: string
          discount?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
          updated_at?: string
          website_url?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          full_name: string | null
          id: string
          last_seen_at: string | null
          must_change_password: boolean
          onboarding_completed: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          last_seen_at?: string | null
          must_change_password?: boolean
          onboarding_completed?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          last_seen_at?: string | null
          must_change_password?: boolean
          onboarding_completed?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      progresso: {
        Row: {
          aula_id: string
          concluido: boolean
          concluido_at: string | null
          created_at: string
          curso_id: string
          id: string
          posicao_segundos: number
          updated_at: string
          user_id: string
        }
        Insert: {
          aula_id: string
          concluido?: boolean
          concluido_at?: string | null
          created_at?: string
          curso_id: string
          id?: string
          posicao_segundos?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          aula_id?: string
          concluido?: boolean
          concluido_at?: string | null
          created_at?: string
          curso_id?: string
          id?: string
          posicao_segundos?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "progresso_aula_id_fkey"
            columns: ["aula_id"]
            isOneToOne: false
            referencedRelation: "aulas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "progresso_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "cursos"
            referencedColumns: ["id"]
          },
        ]
      }
      seals: {
        Row: {
          category: string
          created_at: string
          description: string | null
          icon: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      sync_orphans: {
        Row: {
          action_taken_at: string | null
          action_type: string | null
          aula_id: string
          curso_id: string | null
          detected_at: string | null
          id: string
          panda_video_id: string
          status: string | null
          titulo: string
        }
        Insert: {
          action_taken_at?: string | null
          action_type?: string | null
          aula_id: string
          curso_id?: string | null
          detected_at?: string | null
          id?: string
          panda_video_id: string
          status?: string | null
          titulo: string
        }
        Update: {
          action_taken_at?: string | null
          action_type?: string | null
          aula_id?: string
          curso_id?: string | null
          detected_at?: string | null
          id?: string
          panda_video_id?: string
          status?: string | null
          titulo?: string
        }
        Relationships: []
      }
      thomas_notes: {
        Row: {
          created_at: string
          id: string
          note_text: string
          note_type: string
          updated_at: string
          visibility: string
          wine_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          note_text: string
          note_type?: string
          updated_at?: string
          visibility?: string
          wine_id: string
        }
        Update: {
          created_at?: string
          id?: string
          note_text?: string
          note_type?: string
          updated_at?: string
          visibility?: string
          wine_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "thomas_notes_wine_id_fkey"
            columns: ["wine_id"]
            isOneToOne: false
            referencedRelation: "wines"
            referencedColumns: ["id"]
          },
        ]
      }
      trilha_cursos: {
        Row: {
          created_at: string
          curso_id: string
          id: string
          sort_order: number
          trilha_id: string
        }
        Insert: {
          created_at?: string
          curso_id: string
          id?: string
          sort_order?: number
          trilha_id: string
        }
        Update: {
          created_at?: string
          curso_id?: string
          id?: string
          sort_order?: number
          trilha_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trilha_cursos_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "cursos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trilha_cursos_trilha_id_fkey"
            columns: ["trilha_id"]
            isOneToOne: false
            referencedRelation: "trilhas"
            referencedColumns: ["id"]
          },
        ]
      }
      trilhas: {
        Row: {
          capa_url: string | null
          created_at: string
          descricao: string | null
          id: string
          is_published: boolean
          sort_order: number
          titulo: string
          updated_at: string
        }
        Insert: {
          capa_url?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          is_published?: boolean
          sort_order?: number
          titulo: string
          updated_at?: string
        }
        Update: {
          capa_url?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          is_published?: boolean
          sort_order?: number
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      usage_ledger: {
        Row: {
          estimated_cost_brl: number | null
          estimated_cost_usd: number | null
          id: string
          input_tokens: number | null
          last_request_at: string | null
          month: string
          output_tokens: number | null
          request_count: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          estimated_cost_brl?: number | null
          estimated_cost_usd?: number | null
          id?: string
          input_tokens?: number | null
          last_request_at?: string | null
          month: string
          output_tokens?: number | null
          request_count?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          estimated_cost_brl?: number | null
          estimated_cost_usd?: number | null
          id?: string
          input_tokens?: number | null
          last_request_at?: string | null
          month?: string
          output_tokens?: number | null
          request_count?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      webhook_events: {
        Row: {
          created_at: string
          event_id: string
          event_type: string
          id: string
          payload: Json
          processed_at: string
        }
        Insert: {
          created_at?: string
          event_id: string
          event_type: string
          id?: string
          payload?: Json
          processed_at?: string
        }
        Update: {
          created_at?: string
          event_id?: string
          event_type?: string
          id?: string
          payload?: Json
          processed_at?: string
        }
        Relationships: []
      }
      webhook_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          event_id: string | null
          id: string
          status: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          event_id?: string | null
          id?: string
          status: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          event_id?: string | null
          id?: string
          status?: string
        }
        Relationships: []
      }
      wine_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          updated_at: string
          user_id: string
          wine_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
          wine_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
          wine_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wine_comments_wine_id_fkey"
            columns: ["wine_id"]
            isOneToOne: false
            referencedRelation: "wines"
            referencedColumns: ["id"]
          },
        ]
      }
      wine_seals: {
        Row: {
          id: string
          seal_id: string
          wine_id: string
        }
        Insert: {
          id?: string
          seal_id: string
          wine_id: string
        }
        Update: {
          id?: string
          seal_id?: string
          wine_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wine_seals_seal_id_fkey"
            columns: ["seal_id"]
            isOneToOne: false
            referencedRelation: "seals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wine_seals_wine_id_fkey"
            columns: ["wine_id"]
            isOneToOne: false
            referencedRelation: "wines"
            referencedColumns: ["id"]
          },
        ]
      }
      wine_votes: {
        Row: {
          created_at: string
          id: string
          user_id: string
          vote: string
          wine_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_id: string
          vote: string
          wine_id: string
        }
        Update: {
          created_at?: string
          id?: string
          user_id?: string
          vote?: string
          wine_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wine_votes_wine_id_fkey"
            columns: ["wine_id"]
            isOneToOne: false
            referencedRelation: "wines"
            referencedColumns: ["id"]
          },
        ]
      }
      wines: {
        Row: {
          audio_url: string | null
          country: string | null
          created_at: string
          description: string | null
          drink_or_cellar: string | null
          grape: string | null
          id: string
          image_url: string | null
          importer: string | null
          is_published: boolean
          name: string
          price_range: string | null
          producer: string | null
          rating: number | null
          region: string | null
          status: string
          tasting_notes: string | null
          type: string | null
          updated_at: string
          vintage: number | null
          website_url: string | null
        }
        Insert: {
          audio_url?: string | null
          country?: string | null
          created_at?: string
          description?: string | null
          drink_or_cellar?: string | null
          grape?: string | null
          id?: string
          image_url?: string | null
          importer?: string | null
          is_published?: boolean
          name: string
          price_range?: string | null
          producer?: string | null
          rating?: number | null
          region?: string | null
          status?: string
          tasting_notes?: string | null
          type?: string | null
          updated_at?: string
          vintage?: number | null
          website_url?: string | null
        }
        Update: {
          audio_url?: string | null
          country?: string | null
          created_at?: string
          description?: string | null
          drink_or_cellar?: string | null
          grape?: string | null
          id?: string
          image_url?: string | null
          importer?: string | null
          is_published?: boolean
          name?: string
          price_range?: string | null
          producer?: string | null
          rating?: number | null
          region?: string | null
          status?: string
          tasting_notes?: string | null
          type?: string | null
          updated_at?: string
          vintage?: number | null
          website_url?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      chat_messages_safe: {
        Row: {
          content: string | null
          created_at: string | null
          id: string | null
          mode: string | null
          role: string | null
          session_id: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          id?: string | null
          mode?: string | null
          role?: string | null
          session_id?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string | null
          id?: string | null
          mode?: string | null
          role?: string | null
          session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles_public: {
        Row: {
          avatar_url: string | null
          full_name: string | null
          user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          full_name?: string | null
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          full_name?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      get_course_rankings: {
        Args: { period?: string }
        Returns: {
          capa_url: string
          completion_count: number
          curso_id: string
          nivel: string
          tipo: string
          titulo: string
          total_points: number
        }[]
      }
      get_member_ai_limits: {
        Args: never
        Returns: {
          monthly_cap_brl: number
          rate_limit_per_5min: number
          rate_limit_per_day: number
        }[]
      }
      get_rankings: {
        Args: { period?: string }
        Returns: {
          avatar_url: string
          comment_count: number
          course_count: number
          full_name: string
          membership_type: string
          role: string
          total_points: number
          user_id: string
          vote_count: number
        }[]
      }
      get_user_id_by_email: { Args: { _email: string }; Returns: string }
      get_wine_rankings: {
        Args: { period?: string }
        Returns: {
          comment_count: number
          total_points: number
          vote_count: number
          wine_country: string
          wine_id: string
          wine_image_url: string
          wine_name: string
          wine_type: string
        }[]
      }
      has_active_access: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      list_members_paginated: {
        Args: {
          _membership_type?: string
          _page?: number
          _page_size?: number
          _role?: string
          _search?: string
          _status?: string
        }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "member"
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
      app_role: ["admin", "member"],
    },
  },
} as const
