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
      comentarios: {
        Row: {
          comentario: string
          created_at: string
          fonte: string | null
          gerado_por: string
          id: string
          questao_id: string
          updated_at: string
        }
        Insert: {
          comentario: string
          created_at?: string
          fonte?: string | null
          gerado_por?: string
          id?: string
          questao_id: string
          updated_at?: string
        }
        Update: {
          comentario?: string
          created_at?: string
          fonte?: string | null
          gerado_por?: string
          id?: string
          questao_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comentarios_questao_id_fkey"
            columns: ["questao_id"]
            isOneToOne: true
            referencedRelation: "questoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comentarios_questao_id_fkey"
            columns: ["questao_id"]
            isOneToOne: true
            referencedRelation: "questoes_prova"
            referencedColumns: ["id"]
          },
        ]
      }
      cronograma_blocos: {
        Row: {
          created_at: string
          data_alvo: string
          id: string
          materia_id: string
          minutos_alvo: number
          ordem: number
          origem: Database["public"]["Enums"]["bloco_origem"]
          status: Database["public"]["Enums"]["bloco_status"]
          subtema_id: string | null
          tipo: Database["public"]["Enums"]["cronograma_tipo"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data_alvo: string
          id?: string
          materia_id: string
          minutos_alvo: number
          ordem?: number
          origem?: Database["public"]["Enums"]["bloco_origem"]
          status?: Database["public"]["Enums"]["bloco_status"]
          subtema_id?: string | null
          tipo?: Database["public"]["Enums"]["cronograma_tipo"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          data_alvo?: string
          id?: string
          materia_id?: string
          minutos_alvo?: number
          ordem?: number
          origem?: Database["public"]["Enums"]["bloco_origem"]
          status?: Database["public"]["Enums"]["bloco_status"]
          subtema_id?: string | null
          tipo?: Database["public"]["Enums"]["cronograma_tipo"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cronograma_blocos_materia_id_fkey"
            columns: ["materia_id"]
            isOneToOne: false
            referencedRelation: "materias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cronograma_blocos_subtema_id_fkey"
            columns: ["subtema_id"]
            isOneToOne: false
            referencedRelation: "subtemas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cronograma_blocos_subtema_id_fkey"
            columns: ["subtema_id"]
            isOneToOne: false
            referencedRelation: "v_incidencia_subtema"
            referencedColumns: ["subtema_id"]
          },
          {
            foreignKeyName: "cronograma_blocos_subtema_id_fkey"
            columns: ["subtema_id"]
            isOneToOne: false
            referencedRelation: "v_tendencia_subtema"
            referencedColumns: ["subtema_id"]
          },
        ]
      }
      dimensao_valores: {
        Row: {
          created_at: string
          dimensao_id: string
          id: string
          ordem: number | null
          updated_at: string
          valor: string
        }
        Insert: {
          created_at?: string
          dimensao_id: string
          id?: string
          ordem?: number | null
          updated_at?: string
          valor: string
        }
        Update: {
          created_at?: string
          dimensao_id?: string
          id?: string
          ordem?: number | null
          updated_at?: string
          valor?: string
        }
        Relationships: [
          {
            foreignKeyName: "dimensao_valores_dimensao_id_fkey"
            columns: ["dimensao_id"]
            isOneToOne: false
            referencedRelation: "dimensoes"
            referencedColumns: ["id"]
          },
        ]
      }
      dimensoes: {
        Row: {
          ativa: boolean
          chave: string
          created_at: string
          descricao: string | null
          id: string
          nome: string
          tipo: Database["public"]["Enums"]["dimensao_tipo"]
          updated_at: string
        }
        Insert: {
          ativa?: boolean
          chave: string
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          tipo: Database["public"]["Enums"]["dimensao_tipo"]
          updated_at?: string
        }
        Update: {
          ativa?: boolean
          chave?: string
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          tipo?: Database["public"]["Enums"]["dimensao_tipo"]
          updated_at?: string
        }
        Relationships: []
      }
      estudo_sessoes: {
        Row: {
          anotacao: string | null
          created_at: string
          duracao_min: number
          fim: string | null
          id: string
          inicio: string | null
          local: string | null
          materia_id: string
          material_id: string | null
          micro_topico_id: string | null
          subtema_id: string | null
          tipo_estudo: Database["public"]["Enums"]["tipo_estudo"]
          ts: string
          updated_at: string
          user_id: string
        }
        Insert: {
          anotacao?: string | null
          created_at?: string
          duracao_min: number
          fim?: string | null
          id?: string
          inicio?: string | null
          local?: string | null
          materia_id: string
          material_id?: string | null
          micro_topico_id?: string | null
          subtema_id?: string | null
          tipo_estudo?: Database["public"]["Enums"]["tipo_estudo"]
          ts?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          anotacao?: string | null
          created_at?: string
          duracao_min?: number
          fim?: string | null
          id?: string
          inicio?: string | null
          local?: string | null
          materia_id?: string
          material_id?: string | null
          micro_topico_id?: string | null
          subtema_id?: string | null
          tipo_estudo?: Database["public"]["Enums"]["tipo_estudo"]
          ts?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "estudo_sessoes_materia_id_fkey"
            columns: ["materia_id"]
            isOneToOne: false
            referencedRelation: "materias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estudo_sessoes_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estudo_sessoes_micro_topico_id_fkey"
            columns: ["micro_topico_id"]
            isOneToOne: false
            referencedRelation: "micro_topicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estudo_sessoes_subtema_id_fkey"
            columns: ["subtema_id"]
            isOneToOne: false
            referencedRelation: "subtemas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estudo_sessoes_subtema_id_fkey"
            columns: ["subtema_id"]
            isOneToOne: false
            referencedRelation: "v_incidencia_subtema"
            referencedColumns: ["subtema_id"]
          },
          {
            foreignKeyName: "estudo_sessoes_subtema_id_fkey"
            columns: ["subtema_id"]
            isOneToOne: false
            referencedRelation: "v_tendencia_subtema"
            referencedColumns: ["subtema_id"]
          },
        ]
      }
      exames: {
        Row: {
          ano: number | null
          created_at: string
          data: string | null
          edicao: number | null
          id: string
          numero_romano: string | null
          tipo_prova: Database["public"]["Enums"]["tipo_prova"]
          updated_at: string
        }
        Insert: {
          ano?: number | null
          created_at?: string
          data?: string | null
          edicao?: number | null
          id?: string
          numero_romano?: string | null
          tipo_prova?: Database["public"]["Enums"]["tipo_prova"]
          updated_at?: string
        }
        Update: {
          ano?: number | null
          created_at?: string
          data?: string | null
          edicao?: number | null
          id?: string
          numero_romano?: string | null
          tipo_prova?: Database["public"]["Enums"]["tipo_prova"]
          updated_at?: string
        }
        Relationships: []
      }
      materiais: {
        Row: {
          created_at: string
          id: string
          nome: string
          referencia: string | null
          tipo: Database["public"]["Enums"]["material_tipo"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
          referencia?: string | null
          tipo?: Database["public"]["Enums"]["material_tipo"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          referencia?: string | null
          tipo?: Database["public"]["Enums"]["material_tipo"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      materias: {
        Row: {
          created_at: string
          grupo: Database["public"]["Enums"]["grupo_materia"]
          id: string
          nome: string
          questoes_por_prova: number
          slug: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          grupo: Database["public"]["Enums"]["grupo_materia"]
          id?: string
          nome: string
          questoes_por_prova?: number
          slug?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          grupo?: Database["public"]["Enums"]["grupo_materia"]
          id?: string
          nome?: string
          questoes_por_prova?: number
          slug?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      metas_diarias: {
        Row: {
          created_at: string
          data: string
          id: string
          minutos_meta: number
          nota: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data: string
          id?: string
          minutos_meta: number
          nota?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          data?: string
          id?: string
          minutos_meta?: number
          nota?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      metas_estudo: {
        Row: {
          created_at: string
          dias_estudo: number[]
          id: string
          meta_base_diaria_min: number
          meta_mensal_min: number | null
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          dias_estudo?: number[]
          id?: string
          meta_base_diaria_min?: number
          meta_mensal_min?: number | null
          timezone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          dias_estudo?: number[]
          id?: string
          meta_base_diaria_min?: number
          meta_mensal_min?: number | null
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      micro_topicos: {
        Row: {
          created_at: string
          id: string
          nome: string
          slug: string | null
          subtema_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
          slug?: string | null
          subtema_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          slug?: string | null
          subtema_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "micro_topicos_subtema_id_fkey"
            columns: ["subtema_id"]
            isOneToOne: false
            referencedRelation: "subtemas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "micro_topicos_subtema_id_fkey"
            columns: ["subtema_id"]
            isOneToOne: false
            referencedRelation: "v_incidencia_subtema"
            referencedColumns: ["subtema_id"]
          },
          {
            foreignKeyName: "micro_topicos_subtema_id_fkey"
            columns: ["subtema_id"]
            isOneToOne: false
            referencedRelation: "v_tendencia_subtema"
            referencedColumns: ["subtema_id"]
          },
        ]
      }
      plano_diario: {
        Row: {
          created_at: string
          data: string
          distribuicao_json: Json
          gerado_em: string
          horas: number | null
          id: string
          questoes_alvo: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data: string
          distribuicao_json?: Json
          gerado_em?: string
          horas?: number | null
          id?: string
          questoes_alvo?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          data?: string
          distribuicao_json?: Json
          gerado_em?: string
          horas?: number | null
          id?: string
          questoes_alvo?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      questao_tags: {
        Row: {
          confianca: number | null
          created_at: string
          dimensao_id: string
          id: string
          origem: Database["public"]["Enums"]["tag_origem"]
          questao_id: string
          updated_at: string
          valor_bool: boolean | null
          valor_id: string | null
          valor_num: number | null
        }
        Insert: {
          confianca?: number | null
          created_at?: string
          dimensao_id: string
          id?: string
          origem?: Database["public"]["Enums"]["tag_origem"]
          questao_id: string
          updated_at?: string
          valor_bool?: boolean | null
          valor_id?: string | null
          valor_num?: number | null
        }
        Update: {
          confianca?: number | null
          created_at?: string
          dimensao_id?: string
          id?: string
          origem?: Database["public"]["Enums"]["tag_origem"]
          questao_id?: string
          updated_at?: string
          valor_bool?: boolean | null
          valor_id?: string | null
          valor_num?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "questao_tags_dimensao_id_fkey"
            columns: ["dimensao_id"]
            isOneToOne: false
            referencedRelation: "dimensoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questao_tags_questao_id_fkey"
            columns: ["questao_id"]
            isOneToOne: false
            referencedRelation: "questoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questao_tags_questao_id_fkey"
            columns: ["questao_id"]
            isOneToOne: false
            referencedRelation: "questoes_prova"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questao_tags_valor_id_fkey"
            columns: ["valor_id"]
            isOneToOne: false
            referencedRelation: "dimensao_valores"
            referencedColumns: ["id"]
          },
        ]
      }
      questoes: {
        Row: {
          alt_a: string
          alt_b: string
          alt_c: string
          alt_d: string
          created_at: string
          dificuldade: number | null
          enunciado: string
          exame_id: string | null
          fonte_url: string | null
          gabarito: string | null
          id: string
          materia_id: string | null
          micro_topico_id: string | null
          num_prova: number | null
          subtema_id: string | null
          updated_at: string
          validade_motivo: string | null
          validade_status: Database["public"]["Enums"]["validade_status"]
        }
        Insert: {
          alt_a: string
          alt_b: string
          alt_c: string
          alt_d: string
          created_at?: string
          dificuldade?: number | null
          enunciado: string
          exame_id?: string | null
          fonte_url?: string | null
          gabarito?: string | null
          id?: string
          materia_id?: string | null
          micro_topico_id?: string | null
          num_prova?: number | null
          subtema_id?: string | null
          updated_at?: string
          validade_motivo?: string | null
          validade_status?: Database["public"]["Enums"]["validade_status"]
        }
        Update: {
          alt_a?: string
          alt_b?: string
          alt_c?: string
          alt_d?: string
          created_at?: string
          dificuldade?: number | null
          enunciado?: string
          exame_id?: string | null
          fonte_url?: string | null
          gabarito?: string | null
          id?: string
          materia_id?: string | null
          micro_topico_id?: string | null
          num_prova?: number | null
          subtema_id?: string | null
          updated_at?: string
          validade_motivo?: string | null
          validade_status?: Database["public"]["Enums"]["validade_status"]
        }
        Relationships: [
          {
            foreignKeyName: "questoes_exame_id_fkey"
            columns: ["exame_id"]
            isOneToOne: false
            referencedRelation: "exames"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questoes_materia_id_fkey"
            columns: ["materia_id"]
            isOneToOne: false
            referencedRelation: "materias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questoes_micro_topico_id_fkey"
            columns: ["micro_topico_id"]
            isOneToOne: false
            referencedRelation: "micro_topicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questoes_subtema_id_fkey"
            columns: ["subtema_id"]
            isOneToOne: false
            referencedRelation: "subtemas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questoes_subtema_id_fkey"
            columns: ["subtema_id"]
            isOneToOne: false
            referencedRelation: "v_incidencia_subtema"
            referencedColumns: ["subtema_id"]
          },
          {
            foreignKeyName: "questoes_subtema_id_fkey"
            columns: ["subtema_id"]
            isOneToOne: false
            referencedRelation: "v_tendencia_subtema"
            referencedColumns: ["subtema_id"]
          },
        ]
      }
      respostas: {
        Row: {
          correta: boolean | null
          created_at: string
          id: string
          questao_id: string
          resposta_dada: string | null
          sessao_id: string
          tempo_seg: number | null
          ts: string
          updated_at: string
          user_id: string
        }
        Insert: {
          correta?: boolean | null
          created_at?: string
          id?: string
          questao_id: string
          resposta_dada?: string | null
          sessao_id: string
          tempo_seg?: number | null
          ts?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          correta?: boolean | null
          created_at?: string
          id?: string
          questao_id?: string
          resposta_dada?: string | null
          sessao_id?: string
          tempo_seg?: number | null
          ts?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "respostas_questao_id_fkey"
            columns: ["questao_id"]
            isOneToOne: false
            referencedRelation: "questoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "respostas_questao_id_fkey"
            columns: ["questao_id"]
            isOneToOne: false
            referencedRelation: "questoes_prova"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "respostas_sessao_id_fkey"
            columns: ["sessao_id"]
            isOneToOne: false
            referencedRelation: "sessoes"
            referencedColumns: ["id"]
          },
        ]
      }
      sessoes: {
        Row: {
          created_at: string
          duracao_seg: number | null
          exame_id: string | null
          fim: string | null
          id: string
          inicio: string
          subtema_id: string | null
          tipo: Database["public"]["Enums"]["sessao_tipo"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          duracao_seg?: number | null
          exame_id?: string | null
          fim?: string | null
          id?: string
          inicio?: string
          subtema_id?: string | null
          tipo?: Database["public"]["Enums"]["sessao_tipo"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          duracao_seg?: number | null
          exame_id?: string | null
          fim?: string | null
          id?: string
          inicio?: string
          subtema_id?: string | null
          tipo?: Database["public"]["Enums"]["sessao_tipo"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessoes_exame_id_fkey"
            columns: ["exame_id"]
            isOneToOne: false
            referencedRelation: "exames"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessoes_subtema_id_fkey"
            columns: ["subtema_id"]
            isOneToOne: false
            referencedRelation: "subtemas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessoes_subtema_id_fkey"
            columns: ["subtema_id"]
            isOneToOne: false
            referencedRelation: "v_incidencia_subtema"
            referencedColumns: ["subtema_id"]
          },
          {
            foreignKeyName: "sessoes_subtema_id_fkey"
            columns: ["subtema_id"]
            isOneToOne: false
            referencedRelation: "v_tendencia_subtema"
            referencedColumns: ["subtema_id"]
          },
        ]
      }
      subtemas: {
        Row: {
          created_at: string
          id: string
          materia_id: string
          nome: string
          slug: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          materia_id: string
          nome: string
          slug?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          materia_id?: string
          nome?: string
          slug?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subtemas_materia_id_fkey"
            columns: ["materia_id"]
            isOneToOne: false
            referencedRelation: "materias"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      diag_cross_subtema_dimensao: {
        Row: {
          amostra_suficiente: boolean | null
          atualizado_em: string | null
          dimensao_chave: string | null
          dimensao_nome: string | null
          gate_minimo: number | null
          materia_id: string | null
          n_acertos: number | null
          n_feitas: number | null
          subtema_id: string | null
          subtema_nome: string | null
          taxa: number | null
          ultimo_ts: string | null
          user_id: string | null
          valor_id: string | null
          valor_nome: string | null
        }
        Relationships: [
          {
            foreignKeyName: "questoes_subtema_id_fkey"
            columns: ["subtema_id"]
            isOneToOne: false
            referencedRelation: "subtemas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questoes_subtema_id_fkey"
            columns: ["subtema_id"]
            isOneToOne: false
            referencedRelation: "v_incidencia_subtema"
            referencedColumns: ["subtema_id"]
          },
          {
            foreignKeyName: "questoes_subtema_id_fkey"
            columns: ["subtema_id"]
            isOneToOne: false
            referencedRelation: "v_tendencia_subtema"
            referencedColumns: ["subtema_id"]
          },
          {
            foreignKeyName: "subtemas_materia_id_fkey"
            columns: ["materia_id"]
            isOneToOne: false
            referencedRelation: "materias"
            referencedColumns: ["id"]
          },
        ]
      }
      diag_por_no: {
        Row: {
          amostra_suficiente: boolean | null
          atualizado_em: string | null
          eixo: string | null
          gate_minimo: number | null
          n_acertos: number | null
          n_feitas: number | null
          no_id: string | null
          no_nome: string | null
          primeiro_ts: string | null
          taxa: number | null
          tendencia: number | null
          ultimo_ts: string | null
          user_id: string | null
        }
        Relationships: []
      }
      diag_weakness_score: {
        Row: {
          amostra_suficiente: boolean | null
          atualizado_em: string | null
          confianca_volume: number | null
          eixo: string | null
          n_feitas: number | null
          no_id: string | null
          no_nome: string | null
          peso_incidencia: number | null
          taxa: number | null
          tendencia: number | null
          user_id: string | null
          weakness_score: number | null
        }
        Relationships: []
      }
      questoes_prova: {
        Row: {
          alt_a: string | null
          alt_b: string | null
          alt_c: string | null
          alt_d: string | null
          created_at: string | null
          dificuldade: number | null
          enunciado: string | null
          exame_id: string | null
          fonte_url: string | null
          id: string | null
          materia_id: string | null
          micro_topico_id: string | null
          num_prova: number | null
          subtema_id: string | null
          updated_at: string | null
          validade_status: Database["public"]["Enums"]["validade_status"] | null
        }
        Insert: {
          alt_a?: string | null
          alt_b?: string | null
          alt_c?: string | null
          alt_d?: string | null
          created_at?: string | null
          dificuldade?: number | null
          enunciado?: string | null
          exame_id?: string | null
          fonte_url?: string | null
          id?: string | null
          materia_id?: string | null
          micro_topico_id?: string | null
          num_prova?: number | null
          subtema_id?: string | null
          updated_at?: string | null
          validade_status?:
            | Database["public"]["Enums"]["validade_status"]
            | null
        }
        Update: {
          alt_a?: string | null
          alt_b?: string | null
          alt_c?: string | null
          alt_d?: string | null
          created_at?: string | null
          dificuldade?: number | null
          enunciado?: string | null
          exame_id?: string | null
          fonte_url?: string | null
          id?: string | null
          materia_id?: string | null
          micro_topico_id?: string | null
          num_prova?: number | null
          subtema_id?: string | null
          updated_at?: string | null
          validade_status?:
            | Database["public"]["Enums"]["validade_status"]
            | null
        }
        Relationships: [
          {
            foreignKeyName: "questoes_exame_id_fkey"
            columns: ["exame_id"]
            isOneToOne: false
            referencedRelation: "exames"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questoes_materia_id_fkey"
            columns: ["materia_id"]
            isOneToOne: false
            referencedRelation: "materias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questoes_micro_topico_id_fkey"
            columns: ["micro_topico_id"]
            isOneToOne: false
            referencedRelation: "micro_topicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questoes_subtema_id_fkey"
            columns: ["subtema_id"]
            isOneToOne: false
            referencedRelation: "subtemas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questoes_subtema_id_fkey"
            columns: ["subtema_id"]
            isOneToOne: false
            referencedRelation: "v_incidencia_subtema"
            referencedColumns: ["subtema_id"]
          },
          {
            foreignKeyName: "questoes_subtema_id_fkey"
            columns: ["subtema_id"]
            isOneToOne: false
            referencedRelation: "v_tendencia_subtema"
            referencedColumns: ["subtema_id"]
          },
        ]
      }
      v_esforco_resultado: {
        Row: {
          atualizado_em: string | null
          eixo: string | null
          n_acertos: number | null
          n_feitas: number | null
          n_sessoes: number | null
          no_id: string | null
          no_nome: string | null
          padrao_confiavel: boolean | null
          questoes_ok: boolean | null
          taxa: number | null
          tempo_ok: boolean | null
          total_min: number | null
          user_id: string | null
        }
        Relationships: []
      }
      v_incidencia_subtema: {
        Row: {
          atualizado_em: string | null
          materia_id: string | null
          materia_nome: string | null
          n_disponiveis: number | null
          n_questoes: number | null
          subtema_id: string | null
          subtema_nome: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subtemas_materia_id_fkey"
            columns: ["materia_id"]
            isOneToOne: false
            referencedRelation: "materias"
            referencedColumns: ["id"]
          },
        ]
      }
      v_respostas_corrigidas: {
        Row: {
          correta: boolean | null
          materia_id: string | null
          micro_topico_id: string | null
          questao_id: string | null
          resposta_id: string | null
          sessao_id: string | null
          subtema_id: string | null
          tempo_seg: number | null
          ts: string | null
          user_id: string | null
          validade_status: Database["public"]["Enums"]["validade_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "questoes_materia_id_fkey"
            columns: ["materia_id"]
            isOneToOne: false
            referencedRelation: "materias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questoes_micro_topico_id_fkey"
            columns: ["micro_topico_id"]
            isOneToOne: false
            referencedRelation: "micro_topicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questoes_subtema_id_fkey"
            columns: ["subtema_id"]
            isOneToOne: false
            referencedRelation: "subtemas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questoes_subtema_id_fkey"
            columns: ["subtema_id"]
            isOneToOne: false
            referencedRelation: "v_incidencia_subtema"
            referencedColumns: ["subtema_id"]
          },
          {
            foreignKeyName: "questoes_subtema_id_fkey"
            columns: ["subtema_id"]
            isOneToOne: false
            referencedRelation: "v_tendencia_subtema"
            referencedColumns: ["subtema_id"]
          },
          {
            foreignKeyName: "respostas_questao_id_fkey"
            columns: ["questao_id"]
            isOneToOne: false
            referencedRelation: "questoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "respostas_questao_id_fkey"
            columns: ["questao_id"]
            isOneToOne: false
            referencedRelation: "questoes_prova"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "respostas_sessao_id_fkey"
            columns: ["sessao_id"]
            isOneToOne: false
            referencedRelation: "sessoes"
            referencedColumns: ["id"]
          },
        ]
      }
      v_resultado_comentario: {
        Row: {
          alt_a: string | null
          alt_b: string | null
          alt_c: string | null
          alt_d: string | null
          comentario: string | null
          correta: boolean | null
          enunciado: string | null
          fonte: string | null
          gabarito: string | null
          gerado_por: string | null
          num_prova: number | null
          questao_id: string | null
          resposta_dada: string | null
          resposta_id: string | null
          sessao_id: string | null
          user_id: string | null
          validade_status: Database["public"]["Enums"]["validade_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "respostas_questao_id_fkey"
            columns: ["questao_id"]
            isOneToOne: false
            referencedRelation: "questoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "respostas_questao_id_fkey"
            columns: ["questao_id"]
            isOneToOne: false
            referencedRelation: "questoes_prova"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "respostas_sessao_id_fkey"
            columns: ["sessao_id"]
            isOneToOne: false
            referencedRelation: "sessoes"
            referencedColumns: ["id"]
          },
        ]
      }
      v_saldo_diario: {
        Row: {
          dia: string | null
          meta_min: number | null
          n_sessoes: number | null
          real_min: number | null
          saldo_acum_mes: number | null
          saldo_acum_semana: number | null
          saldo_acum_total: number | null
          saldo_dia: number | null
          user_id: string | null
        }
        Relationships: []
      }
      v_saldo_mensal: {
        Row: {
          mes: string | null
          meta_mensal_min: number | null
          n_sessoes: number | null
          pct_meta: number | null
          real_min: number | null
          saldo_mes: number | null
          user_id: string | null
        }
        Relationships: []
      }
      v_tempo_por_no: {
        Row: {
          eixo: string | null
          n_sessoes: number | null
          no_id: string | null
          no_nome: string | null
          total_min: number | null
          ultimo_ts: string | null
          user_id: string | null
        }
        Relationships: []
      }
      v_tendencia_subtema: {
        Row: {
          ano: number | null
          exame_numero: number | null
          materia_id: string | null
          materia_nome: string | null
          n_questoes: number | null
          subtema_id: string | null
          subtema_nome: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subtemas_materia_id_fkey"
            columns: ["materia_id"]
            isOneToOne: false
            referencedRelation: "materias"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      corrigir_sessao: { Args: { p_sessao_id: string }; Returns: Json }
      diag_gate_minimo: { Args: never; Returns: number }
      esforco_gate_tempo_min: { Args: never; Returns: number }
      meta_do_dia: {
        Args: { p_data: string; p_user_id: string }
        Returns: number
      }
    }
    Enums: {
      bloco_origem: "gerado" | "manual"
      bloco_status: "pendente" | "em_andamento" | "feito"
      cronograma_tipo: "conteudo" | "questoes" | "revisao"
      dimensao_tipo: "categorica" | "booleana" | "numerica"
      grupo_materia: "A" | "B" | "C"
      material_tipo:
        | "livro"
        | "pdf"
        | "video"
        | "curso"
        | "lei"
        | "resumo"
        | "outro"
      sessao_tipo: "prova_oficial" | "simulado" | "treino"
      tag_origem: "humano" | "llm" | "minerado"
      tipo_estudo:
        | "leitura"
        | "video"
        | "resumo"
        | "revisao"
        | "questoes"
        | "outro"
      tipo_prova: "prova_oficial" | "simulado" | "reaplicacao"
      validade_status: "vigente" | "desatualizada" | "anulada" | "em_revisao"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      bloco_origem: ["gerado", "manual"],
      bloco_status: ["pendente", "em_andamento", "feito"],
      cronograma_tipo: ["conteudo", "questoes", "revisao"],
      dimensao_tipo: ["categorica", "booleana", "numerica"],
      grupo_materia: ["A", "B", "C"],
      material_tipo: [
        "livro",
        "pdf",
        "video",
        "curso",
        "lei",
        "resumo",
        "outro",
      ],
      sessao_tipo: ["prova_oficial", "simulado", "treino"],
      tag_origem: ["humano", "llm", "minerado"],
      tipo_estudo: [
        "leitura",
        "video",
        "resumo",
        "revisao",
        "questoes",
        "outro",
      ],
      tipo_prova: ["prova_oficial", "simulado", "reaplicacao"],
      validade_status: ["vigente", "desatualizada", "anulada", "em_revisao"],
    },
  },
} as const
