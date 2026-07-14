/**
 * Supabase database types.
 * Run `npx supabase gen types typescript --local > lib/db/database.types.ts`
 * to regenerate after schema changes.
 *
 * For now, these are manually maintained to match our migration.
 */

import type {
  ProjectType,
  ProjectVisibility,
  AccountStatus,
  NotificationType,
  ReportReason,
  ModerationAction,
  ProjectMeta,
  CoverConfig,
} from '@/types'

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          username: string
          avatar_url: string | null
          bio: string | null
          account_status: AccountStatus
          restriction_until: string | null
          created_at: string
        }
        Insert: {
          id: string
          username: string
          avatar_url?: string | null
          bio?: string | null
          account_status?: AccountStatus
          restriction_until?: string | null
          created_at?: string
        }
        Update: {
          username?: string
          avatar_url?: string | null
          bio?: string | null
          account_status?: AccountStatus
          restriction_until?: string | null
        }
        Relationships: []
      }

      projects: {
        Row: {
          id: string
          creator_id: string
          title: string
          description: string | null
          type: ProjectType
          meta_json: ProjectMeta
          bundle_path: string | null
          cover_config: CoverConfig
          visibility: ProjectVisibility
          remix_of: string | null
          play_count: number
          like_count: number
          remix_count: number
          published_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          creator_id: string
          title: string
          description?: string | null
          type: ProjectType
          meta_json?: ProjectMeta
          bundle_path?: string | null
          cover_config?: CoverConfig
          visibility?: ProjectVisibility
          remix_of?: string | null
          play_count?: number
          like_count?: number
          remix_count?: number
          published_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          title?: string
          description?: string | null
          type?: ProjectType
          meta_json?: ProjectMeta
          bundle_path?: string | null
          cover_config?: CoverConfig
          visibility?: ProjectVisibility
          remix_of?: string | null
          play_count?: number
          like_count?: number
          remix_count?: number
          published_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }

      project_versions: {
        Row: {
          id: string
          project_id: string
          bundle_path: string | null
          html: string | null
          meta_json: ProjectMeta
          version_num: number
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          bundle_path?: string | null
          html?: string | null
          meta_json?: ProjectMeta
          version_num: number
          created_at?: string
        }
        Update: Record<string, never>
        Relationships: []
      }

      likes: {
        Row: {
          user_id: string
          project_id: string
          created_at: string
        }
        Insert: {
          user_id: string
          project_id: string
          created_at?: string
        }
        Update: Record<string, never>
        Relationships: []
      }

      reports: {
        Row: {
          id: string
          project_id: string
          reporter_id: string
          reason: ReportReason
          status: 'pending' | 'safe' | 'actioned'
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          reporter_id: string
          reason: ReportReason
          status?: 'pending' | 'safe' | 'actioned'
          created_at?: string
        }
        Update: {
          status?: 'pending' | 'safe' | 'actioned'
        }
        Relationships: []
      }

      moderation_actions: {
        Row: {
          id: string
          user_id: string
          action_type: ModerationAction
          reason: string
          project_id: string | null
          expires_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          action_type: ModerationAction
          reason: string
          project_id?: string | null
          expires_at?: string | null
          created_at?: string
        }
        Update: Record<string, never>
        Relationships: []
      }

      notifications: {
        Row: {
          id: string
          user_id: string
          type: NotificationType
          data: Record<string, unknown>
          read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          type: NotificationType
          data?: Record<string, unknown>
          read?: boolean
          created_at?: string
        }
        Update: {
          read?: boolean
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      increment_play_count: {
        Args: { project_id: string }
        Returns: undefined
      }
      increment_like_count: {
        Args: { project_id: string }
        Returns: undefined
      }
      decrement_like_count: {
        Args: { project_id: string }
        Returns: undefined
      }
      increment_remix_count: {
        Args: { project_id: string }
        Returns: undefined
      }
      snapshot_version: {
        Args: { p_project_id: string; p_html: string }
        Returns: undefined
      }
    }
    Enums: Record<string, never>
  }
}
