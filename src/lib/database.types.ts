export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string;
          actor_id: string;
          created_at: string;
          id: string;
          metadata: Json;
          new_values: Json | null;
          old_values: Json | null;
          reason: string | null;
          target_id: string | null;
          target_type: string;
        };
        Insert: {
          action: string;
          actor_id: string;
          created_at?: string;
          id?: string;
          metadata?: Json;
          new_values?: Json | null;
          old_values?: Json | null;
          reason?: string | null;
          target_id?: string | null;
          target_type: string;
        };
        Update: {
          action?: string;
          actor_id?: string;
          created_at?: string;
          id?: string;
          metadata?: Json;
          new_values?: Json | null;
          old_values?: Json | null;
          reason?: string | null;
          target_id?: string | null;
          target_type?: string;
        };
        Relationships: [];
      };
      badges: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          name: string;
          required_issuer_permission: string | null;
          slug: string;
          sort_order: number;
          status: Database["public"]["Enums"]["badge_status"];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          name: string;
          required_issuer_permission?: string | null;
          slug: string;
          sort_order?: number;
          status?: Database["public"]["Enums"]["badge_status"];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          name?: string;
          required_issuer_permission?: string | null;
          slug?: string;
          sort_order?: number;
          status?: Database["public"]["Enums"]["badge_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "badges_required_issuer_permission_fkey";
            columns: ["required_issuer_permission"];
            isOneToOne: false;
            referencedRelation: "permissions";
            referencedColumns: ["name"];
          },
        ];
      };
      blocks: {
        Row: {
          blocked_id: string;
          blocker_id: string;
          created_at: string;
          id: string;
        };
        Insert: {
          blocked_id: string;
          blocker_id: string;
          created_at?: string;
          id?: string;
        };
        Update: {
          blocked_id?: string;
          blocker_id?: string;
          created_at?: string;
          id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "blocks_blocked_id_fkey";
            columns: ["blocked_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "blocks_blocker_id_fkey";
            columns: ["blocker_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      bookmarks: {
        Row: {
          created_at: string;
          id: string;
          post_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          post_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          post_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "bookmarks_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "posts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookmarks_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      chat_channel_members: {
        Row: {
          added_by: string | null;
          channel_id: string;
          created_at: string;
          id: string;
          member_id: string;
        };
        Insert: {
          added_by?: string | null;
          channel_id: string;
          created_at?: string;
          id?: string;
          member_id: string;
        };
        Update: {
          added_by?: string | null;
          channel_id?: string;
          created_at?: string;
          id?: string;
          member_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "chat_channel_members_added_by_fkey";
            columns: ["added_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "chat_channel_members_channel_id_fkey";
            columns: ["channel_id"];
            isOneToOne: false;
            referencedRelation: "chat_channels";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "chat_channel_members_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      chat_channels: {
        Row: {
          clan_id: string | null;
          created_at: string;
          created_by: string | null;
          description: string | null;
          id: string;
          kind: Database["public"]["Enums"]["chat_channel_kind"];
          name: string;
          slug: string;
          sort_order: number;
          status: Database["public"]["Enums"]["chat_channel_status"];
          updated_at: string;
        };
        Insert: {
          clan_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          kind?: Database["public"]["Enums"]["chat_channel_kind"];
          name: string;
          slug: string;
          sort_order?: number;
          status?: Database["public"]["Enums"]["chat_channel_status"];
          updated_at?: string;
        };
        Update: {
          clan_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          kind?: Database["public"]["Enums"]["chat_channel_kind"];
          name?: string;
          slug?: string;
          sort_order?: number;
          status?: Database["public"]["Enums"]["chat_channel_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "chat_channels_clan_id_fkey";
            columns: ["clan_id"];
            isOneToOne: false;
            referencedRelation: "clans";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "chat_channels_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      chat_message_edits: {
        Row: {
          created_at: string;
          editor_id: string | null;
          id: string;
          message_id: string;
          old_body: string;
          seq: number;
        };
        Insert: {
          created_at?: string;
          editor_id?: string | null;
          id?: string;
          message_id: string;
          old_body: string;
          seq?: never;
        };
        Update: {
          created_at?: string;
          editor_id?: string | null;
          id?: string;
          message_id?: string;
          old_body?: string;
          seq?: never;
        };
        Relationships: [
          {
            foreignKeyName: "chat_message_edits_editor_id_fkey";
            columns: ["editor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "chat_message_edits_message_id_fkey";
            columns: ["message_id"];
            isOneToOne: false;
            referencedRelation: "chat_messages";
            referencedColumns: ["id"];
          },
        ];
      };
      chat_messages: {
        Row: {
          author_id: string;
          body: string;
          channel_id: string;
          created_at: string;
          edited_at: string | null;
          id: string;
          is_pinned: boolean;
          parent_id: string | null;
          replies_count: number;
          status: Database["public"]["Enums"]["chat_message_status"];
          updated_at: string;
        };
        Insert: {
          author_id: string;
          body: string;
          channel_id: string;
          created_at?: string;
          edited_at?: string | null;
          id?: string;
          is_pinned?: boolean;
          parent_id?: string | null;
          replies_count?: number;
          status?: Database["public"]["Enums"]["chat_message_status"];
          updated_at?: string;
        };
        Update: {
          author_id?: string;
          body?: string;
          channel_id?: string;
          created_at?: string;
          edited_at?: string | null;
          id?: string;
          is_pinned?: boolean;
          parent_id?: string | null;
          replies_count?: number;
          status?: Database["public"]["Enums"]["chat_message_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "chat_messages_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "chat_messages_channel_id_fkey";
            columns: ["channel_id"];
            isOneToOne: false;
            referencedRelation: "chat_channels";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "chat_messages_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: false;
            referencedRelation: "chat_messages";
            referencedColumns: ["id"];
          },
        ];
      };
      chat_mutes: {
        Row: {
          created_at: string;
          expires_at: string | null;
          id: string;
          muted_by: string | null;
          reason: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          expires_at?: string | null;
          id?: string;
          muted_by?: string | null;
          reason: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          expires_at?: string | null;
          id?: string;
          muted_by?: string | null;
          reason?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "chat_mutes_muted_by_fkey";
            columns: ["muted_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "chat_mutes_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      chat_reactions: {
        Row: {
          actor_id: string;
          created_at: string;
          id: string;
          message_id: string;
          reaction_id: string;
        };
        Insert: {
          actor_id: string;
          created_at?: string;
          id?: string;
          message_id: string;
          reaction_id: string;
        };
        Update: {
          actor_id?: string;
          created_at?: string;
          id?: string;
          message_id?: string;
          reaction_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "chat_reactions_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "chat_reactions_message_id_fkey";
            columns: ["message_id"];
            isOneToOne: false;
            referencedRelation: "chat_messages";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "chat_reactions_reaction_id_fkey";
            columns: ["reaction_id"];
            isOneToOne: false;
            referencedRelation: "reactions";
            referencedColumns: ["id"];
          },
        ];
      };
      clan_internal_permissions: {
        Row: {
          internal_role_id: string;
          permission: string;
        };
        Insert: {
          internal_role_id: string;
          permission: string;
        };
        Update: {
          internal_role_id?: string;
          permission?: string;
        };
        Relationships: [
          {
            foreignKeyName: "clan_internal_permissions_internal_role_id_fkey";
            columns: ["internal_role_id"];
            isOneToOne: false;
            referencedRelation: "clan_internal_roles";
            referencedColumns: ["id"];
          },
        ];
      };
      clan_internal_roles: {
        Row: {
          clan_id: string;
          created_at: string;
          description: string | null;
          id: string;
          name: string;
          updated_at: string;
        };
        Insert: {
          clan_id: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          name: string;
          updated_at?: string;
        };
        Update: {
          clan_id?: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          name?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "clan_internal_roles_clan_id_fkey";
            columns: ["clan_id"];
            isOneToOne: false;
            referencedRelation: "clans";
            referencedColumns: ["id"];
          },
        ];
      };
      clan_members: {
        Row: {
          clan_id: string;
          created_at: string;
          id: string;
          joined_at: string | null;
          member_id: string;
          resolution_note: string | null;
          resolved_at: string | null;
          resolved_by: string | null;
          role: Database["public"]["Enums"]["clan_member_role"];
          status: Database["public"]["Enums"]["clan_member_status"];
          updated_at: string;
        };
        Insert: {
          clan_id: string;
          created_at?: string;
          id?: string;
          joined_at?: string | null;
          member_id: string;
          resolution_note?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          role?: Database["public"]["Enums"]["clan_member_role"];
          status?: Database["public"]["Enums"]["clan_member_status"];
          updated_at?: string;
        };
        Update: {
          clan_id?: string;
          created_at?: string;
          id?: string;
          joined_at?: string | null;
          member_id?: string;
          resolution_note?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          role?: Database["public"]["Enums"]["clan_member_role"];
          status?: Database["public"]["Enums"]["clan_member_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "clan_members_clan_id_fkey";
            columns: ["clan_id"];
            isOneToOne: false;
            referencedRelation: "clans";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "clan_members_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "clan_members_resolved_by_fkey";
            columns: ["resolved_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      clan_role_members: {
        Row: {
          assigned_at: string;
          assigned_by: string;
          clan_member_id: string;
          id: string;
          internal_role_id: string;
        };
        Insert: {
          assigned_at?: string;
          assigned_by: string;
          clan_member_id: string;
          id?: string;
          internal_role_id: string;
        };
        Update: {
          assigned_at?: string;
          assigned_by?: string;
          clan_member_id?: string;
          id?: string;
          internal_role_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "clan_role_members_assigned_by_fkey";
            columns: ["assigned_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "clan_role_members_clan_member_id_fkey";
            columns: ["clan_member_id"];
            isOneToOne: false;
            referencedRelation: "clan_members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "clan_role_members_internal_role_id_fkey";
            columns: ["internal_role_id"];
            isOneToOne: false;
            referencedRelation: "clan_internal_roles";
            referencedColumns: ["id"];
          },
        ];
      };
      clans: {
        Row: {
          created_at: string;
          description: string | null;
          emblem_path: string | null;
          id: string;
          leader_id: string | null;
          member_count: number;
          mission: string | null;
          name: string;
          privacy: Database["public"]["Enums"]["clan_privacy"];
          slug: string;
          status: Database["public"]["Enums"]["clan_status"];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          emblem_path?: string | null;
          id?: string;
          leader_id?: string | null;
          member_count?: number;
          mission?: string | null;
          name: string;
          privacy?: Database["public"]["Enums"]["clan_privacy"];
          slug: string;
          status?: Database["public"]["Enums"]["clan_status"];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          emblem_path?: string | null;
          id?: string;
          leader_id?: string | null;
          member_count?: number;
          mission?: string | null;
          name?: string;
          privacy?: Database["public"]["Enums"]["clan_privacy"];
          slug?: string;
          status?: Database["public"]["Enums"]["clan_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "clans_leader_id_fkey";
            columns: ["leader_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      codex_articles: {
        Row: {
          author_id: string;
          body: string;
          category_id: string;
          created_at: string;
          excerpt: string | null;
          id: string;
          published_at: string | null;
          slug: string;
          status: Database["public"]["Enums"]["codex_article_status"];
          title: string;
          updated_at: string;
          version: number;
        };
        Insert: {
          author_id: string;
          body: string;
          category_id: string;
          created_at?: string;
          excerpt?: string | null;
          id?: string;
          published_at?: string | null;
          slug: string;
          status?: Database["public"]["Enums"]["codex_article_status"];
          title: string;
          updated_at?: string;
          version?: number;
        };
        Update: {
          author_id?: string;
          body?: string;
          category_id?: string;
          created_at?: string;
          excerpt?: string | null;
          id?: string;
          published_at?: string | null;
          slug?: string;
          status?: Database["public"]["Enums"]["codex_article_status"];
          title?: string;
          updated_at?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "codex_articles_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "codex_articles_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "codex_categories";
            referencedColumns: ["id"];
          },
        ];
      };
      codex_bookmarks: {
        Row: {
          article_id: string;
          created_at: string;
          id: string;
          user_id: string;
        };
        Insert: {
          article_id: string;
          created_at?: string;
          id?: string;
          user_id: string;
        };
        Update: {
          article_id?: string;
          created_at?: string;
          id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "codex_bookmarks_article_id_fkey";
            columns: ["article_id"];
            isOneToOne: false;
            referencedRelation: "codex_articles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "codex_bookmarks_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      codex_categories: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          name: string;
          slug: string;
          sort_order: number;
          status: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          name: string;
          slug: string;
          sort_order?: number;
          status?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          name?: string;
          slug?: string;
          sort_order?: number;
          status?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      codex_proposal_contributors: {
        Row: {
          attribution: Database["public"]["Enums"]["codex_attribution"];
          confirmed_at: string | null;
          confirmed_by: string | null;
          contribution_type: Database["public"]["Enums"]["codex_contribution_type"];
          created_at: string;
          evidence_ref: string | null;
          id: string;
          member_id: string;
          proposal_id: string;
          status: Database["public"]["Enums"]["codex_contribution_status"];
        };
        Insert: {
          attribution?: Database["public"]["Enums"]["codex_attribution"];
          confirmed_at?: string | null;
          confirmed_by?: string | null;
          contribution_type: Database["public"]["Enums"]["codex_contribution_type"];
          created_at?: string;
          evidence_ref?: string | null;
          id?: string;
          member_id: string;
          proposal_id: string;
          status?: Database["public"]["Enums"]["codex_contribution_status"];
        };
        Update: {
          attribution?: Database["public"]["Enums"]["codex_attribution"];
          confirmed_at?: string | null;
          confirmed_by?: string | null;
          contribution_type?: Database["public"]["Enums"]["codex_contribution_type"];
          created_at?: string;
          evidence_ref?: string | null;
          id?: string;
          member_id?: string;
          proposal_id?: string;
          status?: Database["public"]["Enums"]["codex_contribution_status"];
        };
        Relationships: [
          {
            foreignKeyName: "codex_proposal_contributors_confirmed_by_fkey";
            columns: ["confirmed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "codex_proposal_contributors_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "codex_proposal_contributors_proposal_id_fkey";
            columns: ["proposal_id"];
            isOneToOne: false;
            referencedRelation: "codex_proposals";
            referencedColumns: ["id"];
          },
        ];
      };
      codex_proposal_sources: {
        Row: {
          added_by: string;
          chat_message_id: string | null;
          comment_id: string | null;
          created_at: string;
          external_url: string | null;
          id: string;
          note: string | null;
          post_id: string | null;
          proposal_id: string;
          source_type: Database["public"]["Enums"]["codex_source_type"];
        };
        Insert: {
          added_by: string;
          chat_message_id?: string | null;
          comment_id?: string | null;
          created_at?: string;
          external_url?: string | null;
          id?: string;
          note?: string | null;
          post_id?: string | null;
          proposal_id: string;
          source_type: Database["public"]["Enums"]["codex_source_type"];
        };
        Update: {
          added_by?: string;
          chat_message_id?: string | null;
          comment_id?: string | null;
          created_at?: string;
          external_url?: string | null;
          id?: string;
          note?: string | null;
          post_id?: string | null;
          proposal_id?: string;
          source_type?: Database["public"]["Enums"]["codex_source_type"];
        };
        Relationships: [
          {
            foreignKeyName: "codex_proposal_sources_added_by_fkey";
            columns: ["added_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "codex_proposal_sources_comment_id_fkey";
            columns: ["comment_id"];
            isOneToOne: false;
            referencedRelation: "comments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "codex_proposal_sources_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "posts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "codex_proposal_sources_proposal_id_fkey";
            columns: ["proposal_id"];
            isOneToOne: false;
            referencedRelation: "codex_proposals";
            referencedColumns: ["id"];
          },
        ];
      };
      codex_proposals: {
        Row: {
          article_id: string | null;
          assignee_id: string | null;
          created_at: string;
          id: string;
          proposer_id: string;
          reason: string;
          replaced_by: string | null;
          status: Database["public"]["Enums"]["codex_proposal_status"];
          updated_at: string;
          working_title: string | null;
        };
        Insert: {
          article_id?: string | null;
          assignee_id?: string | null;
          created_at?: string;
          id?: string;
          proposer_id: string;
          reason: string;
          replaced_by?: string | null;
          status?: Database["public"]["Enums"]["codex_proposal_status"];
          updated_at?: string;
          working_title?: string | null;
        };
        Update: {
          article_id?: string | null;
          assignee_id?: string | null;
          created_at?: string;
          id?: string;
          proposer_id?: string;
          reason?: string;
          replaced_by?: string | null;
          status?: Database["public"]["Enums"]["codex_proposal_status"];
          updated_at?: string;
          working_title?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "codex_proposals_article_id_fkey";
            columns: ["article_id"];
            isOneToOne: false;
            referencedRelation: "codex_articles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "codex_proposals_assignee_id_fkey";
            columns: ["assignee_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "codex_proposals_proposer_id_fkey";
            columns: ["proposer_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "codex_proposals_replaced_by_fkey";
            columns: ["replaced_by"];
            isOneToOne: false;
            referencedRelation: "codex_proposals";
            referencedColumns: ["id"];
          },
        ];
      };
      codex_suggestions: {
        Row: {
          article_id: string;
          body: string;
          created_at: string;
          id: string;
          review_note: string | null;
          reviewed_at: string | null;
          reviewed_by: string | null;
          status: Database["public"]["Enums"]["codex_suggestion_status"];
          suggester_id: string;
          updated_at: string;
        };
        Insert: {
          article_id: string;
          body: string;
          created_at?: string;
          id?: string;
          review_note?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: Database["public"]["Enums"]["codex_suggestion_status"];
          suggester_id: string;
          updated_at?: string;
        };
        Update: {
          article_id?: string;
          body?: string;
          created_at?: string;
          id?: string;
          review_note?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: Database["public"]["Enums"]["codex_suggestion_status"];
          suggester_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "codex_suggestions_article_id_fkey";
            columns: ["article_id"];
            isOneToOne: false;
            referencedRelation: "codex_articles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "codex_suggestions_reviewed_by_fkey";
            columns: ["reviewed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "codex_suggestions_suggester_id_fkey";
            columns: ["suggester_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      codex_versions: {
        Row: {
          article_id: string;
          body: string;
          change_summary: string | null;
          created_at: string;
          editor_id: string | null;
          id: string;
          seq: number;
          title: string;
          version: number;
        };
        Insert: {
          article_id: string;
          body: string;
          change_summary?: string | null;
          created_at?: string;
          editor_id?: string | null;
          id?: string;
          seq?: never;
          title: string;
          version: number;
        };
        Update: {
          article_id?: string;
          body?: string;
          change_summary?: string | null;
          created_at?: string;
          editor_id?: string | null;
          id?: string;
          seq?: never;
          title?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "codex_versions_article_id_fkey";
            columns: ["article_id"];
            isOneToOne: false;
            referencedRelation: "codex_articles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "codex_versions_editor_id_fkey";
            columns: ["editor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      comments: {
        Row: {
          author_id: string;
          body: string;
          created_at: string;
          depth: number;
          dislikes_count: number;
          id: string;
          is_pinned: boolean;
          likes_count: number;
          parent_id: string | null;
          post_id: string;
          removed_at: string | null;
          replies_count: number;
          replies_locked: boolean;
          status: Database["public"]["Enums"]["comment_status"];
          updated_at: string;
        };
        Insert: {
          author_id: string;
          body: string;
          created_at?: string;
          depth?: number;
          dislikes_count?: number;
          id?: string;
          is_pinned?: boolean;
          likes_count?: number;
          parent_id?: string | null;
          post_id: string;
          removed_at?: string | null;
          replies_count?: number;
          replies_locked?: boolean;
          status?: Database["public"]["Enums"]["comment_status"];
          updated_at?: string;
        };
        Update: {
          author_id?: string;
          body?: string;
          created_at?: string;
          depth?: number;
          dislikes_count?: number;
          id?: string;
          is_pinned?: boolean;
          likes_count?: number;
          parent_id?: string | null;
          post_id?: string;
          removed_at?: string | null;
          replies_count?: number;
          replies_locked?: boolean;
          status?: Database["public"]["Enums"]["comment_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "comments_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "comments_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: false;
            referencedRelation: "comments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "comments_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "posts";
            referencedColumns: ["id"];
          },
        ];
      };
      content_reactions: {
        Row: {
          actor_id: string;
          comment_id: string | null;
          created_at: string;
          id: string;
          post_id: string | null;
          reaction_id: string;
        };
        Insert: {
          actor_id: string;
          comment_id?: string | null;
          created_at?: string;
          id?: string;
          post_id?: string | null;
          reaction_id: string;
        };
        Update: {
          actor_id?: string;
          comment_id?: string | null;
          created_at?: string;
          id?: string;
          post_id?: string | null;
          reaction_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "content_reactions_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "content_reactions_comment_id_fkey";
            columns: ["comment_id"];
            isOneToOne: false;
            referencedRelation: "comments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "content_reactions_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "posts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "content_reactions_reaction_id_fkey";
            columns: ["reaction_id"];
            isOneToOne: false;
            referencedRelation: "reactions";
            referencedColumns: ["id"];
          },
        ];
      };
      content_reports: {
        Row: {
          chat_message_id: string | null;
          comment_id: string | null;
          created_at: string;
          details: string | null;
          id: string;
          post_id: string | null;
          profile_id: string | null;
          reason: Database["public"]["Enums"]["report_reason"];
          reporter_id: string;
          resolution: string | null;
          resolved_at: string | null;
          resolved_by: string | null;
          status: Database["public"]["Enums"]["report_status"];
          updated_at: string;
        };
        Insert: {
          chat_message_id?: string | null;
          comment_id?: string | null;
          created_at?: string;
          details?: string | null;
          id?: string;
          post_id?: string | null;
          profile_id?: string | null;
          reason: Database["public"]["Enums"]["report_reason"];
          reporter_id: string;
          resolution?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          status?: Database["public"]["Enums"]["report_status"];
          updated_at?: string;
        };
        Update: {
          chat_message_id?: string | null;
          comment_id?: string | null;
          created_at?: string;
          details?: string | null;
          id?: string;
          post_id?: string | null;
          profile_id?: string | null;
          reason?: Database["public"]["Enums"]["report_reason"];
          reporter_id?: string;
          resolution?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          status?: Database["public"]["Enums"]["report_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "content_reports_chat_message_fkey";
            columns: ["chat_message_id"];
            isOneToOne: false;
            referencedRelation: "chat_messages";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "content_reports_comment_id_fkey";
            columns: ["comment_id"];
            isOneToOne: false;
            referencedRelation: "comments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "content_reports_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "posts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "content_reports_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "content_reports_reporter_id_fkey";
            columns: ["reporter_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "content_reports_resolved_by_fkey";
            columns: ["resolved_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      content_revisions: {
        Row: {
          body: string;
          comment_id: string | null;
          created_at: string;
          editor_id: string | null;
          id: string;
          post_id: string | null;
          seq: number;
          title: string | null;
        };
        Insert: {
          body: string;
          comment_id?: string | null;
          created_at?: string;
          editor_id?: string | null;
          id?: string;
          post_id?: string | null;
          seq?: never;
          title?: string | null;
        };
        Update: {
          body?: string;
          comment_id?: string | null;
          created_at?: string;
          editor_id?: string | null;
          id?: string;
          post_id?: string | null;
          seq?: never;
          title?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "content_revisions_comment_id_fkey";
            columns: ["comment_id"];
            isOneToOne: false;
            referencedRelation: "comments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "content_revisions_editor_id_fkey";
            columns: ["editor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "content_revisions_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "posts";
            referencedColumns: ["id"];
          },
        ];
      };
      content_votes: {
        Row: {
          comment_id: string | null;
          created_at: string;
          id: string;
          post_id: string | null;
          updated_at: string;
          value: number;
          voter_id: string;
        };
        Insert: {
          comment_id?: string | null;
          created_at?: string;
          id?: string;
          post_id?: string | null;
          updated_at?: string;
          value: number;
          voter_id: string;
        };
        Update: {
          comment_id?: string | null;
          created_at?: string;
          id?: string;
          post_id?: string | null;
          updated_at?: string;
          value?: number;
          voter_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "content_votes_comment_id_fkey";
            columns: ["comment_id"];
            isOneToOne: false;
            referencedRelation: "comments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "content_votes_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "posts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "content_votes_voter_id_fkey";
            columns: ["voter_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      event_outbox: {
        Row: {
          aggregate_id: string | null;
          aggregate_type: string | null;
          attempts: number;
          created_at: string;
          dedupe_key: string | null;
          event_type: string;
          id: string;
          last_error: string | null;
          max_attempts: number;
          next_attempt_at: string;
          payload: Json;
          status: Database["public"]["Enums"]["outbox_status"];
          updated_at: string;
        };
        Insert: {
          aggregate_id?: string | null;
          aggregate_type?: string | null;
          attempts?: number;
          created_at?: string;
          dedupe_key?: string | null;
          event_type: string;
          id?: string;
          last_error?: string | null;
          max_attempts?: number;
          next_attempt_at?: string;
          payload?: Json;
          status?: Database["public"]["Enums"]["outbox_status"];
          updated_at?: string;
        };
        Update: {
          aggregate_id?: string | null;
          aggregate_type?: string | null;
          attempts?: number;
          created_at?: string;
          dedupe_key?: string | null;
          event_type?: string;
          id?: string;
          last_error?: string | null;
          max_attempts?: number;
          next_attempt_at?: string;
          payload?: Json;
          status?: Database["public"]["Enums"]["outbox_status"];
          updated_at?: string;
        };
        Relationships: [];
      };
      friendships: {
        Row: {
          addressee_id: string;
          created_at: string;
          id: string;
          requester_id: string;
          status: Database["public"]["Enums"]["friendship_status"];
          updated_at: string;
        };
        Insert: {
          addressee_id: string;
          created_at?: string;
          id?: string;
          requester_id: string;
          status?: Database["public"]["Enums"]["friendship_status"];
          updated_at?: string;
        };
        Update: {
          addressee_id?: string;
          created_at?: string;
          id?: string;
          requester_id?: string;
          status?: Database["public"]["Enums"]["friendship_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "friendships_addressee_id_fkey";
            columns: ["addressee_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "friendships_requester_id_fkey";
            columns: ["requester_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      moderation_appeals: {
        Row: {
          appellant_id: string;
          audit_log_id: string;
          body: string;
          created_at: string;
          decided_at: string | null;
          decided_by: string | null;
          decision: string | null;
          id: string;
          status: Database["public"]["Enums"]["appeal_status"];
          updated_at: string;
        };
        Insert: {
          appellant_id: string;
          audit_log_id: string;
          body: string;
          created_at?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          decision?: string | null;
          id?: string;
          status?: Database["public"]["Enums"]["appeal_status"];
          updated_at?: string;
        };
        Update: {
          appellant_id?: string;
          audit_log_id?: string;
          body?: string;
          created_at?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          decision?: string | null;
          id?: string;
          status?: Database["public"]["Enums"]["appeal_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "moderation_appeals_appellant_id_fkey";
            columns: ["appellant_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "moderation_appeals_audit_log_id_fkey";
            columns: ["audit_log_id"];
            isOneToOne: false;
            referencedRelation: "audit_logs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "moderation_appeals_decided_by_fkey";
            columns: ["decided_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      moderator_notes: {
        Row: {
          actor_id: string | null;
          body: string;
          created_at: string;
          id: string;
          subject_id: string;
          updated_at: string;
        };
        Insert: {
          actor_id?: string | null;
          body: string;
          created_at?: string;
          id?: string;
          subject_id: string;
          updated_at?: string;
        };
        Update: {
          actor_id?: string | null;
          body?: string;
          created_at?: string;
          id?: string;
          subject_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "moderator_notes_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "moderator_notes_subject_id_fkey";
            columns: ["subject_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      notification_preferences: {
        Row: {
          created_at: string;
          types: Json;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          types?: Json;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          types?: Json;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notification_preferences_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      notifications: {
        Row: {
          actor_id: string | null;
          created_at: string;
          dedupe_key: string | null;
          id: string;
          payload: Json;
          read_at: string | null;
          recipient_id: string;
          type: Database["public"]["Enums"]["notification_type"];
        };
        Insert: {
          actor_id?: string | null;
          created_at?: string;
          dedupe_key?: string | null;
          id?: string;
          payload?: Json;
          read_at?: string | null;
          recipient_id: string;
          type: Database["public"]["Enums"]["notification_type"];
        };
        Update: {
          actor_id?: string | null;
          created_at?: string;
          dedupe_key?: string | null;
          id?: string;
          payload?: Json;
          read_at?: string | null;
          recipient_id?: string;
          type?: Database["public"]["Enums"]["notification_type"];
        };
        Relationships: [
          {
            foreignKeyName: "notifications_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_recipient_id_fkey";
            columns: ["recipient_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      permissions: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          name: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          name: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          name?: string;
        };
        Relationships: [];
      };
      plazas: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          name: string;
          posts_count: number;
          required_post_permission: string | null;
          rules: string | null;
          slug: string;
          sort_order: number;
          status: Database["public"]["Enums"]["plaza_status"];
          updated_at: string;
          visibility: Database["public"]["Enums"]["plaza_visibility"];
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          name: string;
          posts_count?: number;
          required_post_permission?: string | null;
          rules?: string | null;
          slug: string;
          sort_order?: number;
          status?: Database["public"]["Enums"]["plaza_status"];
          updated_at?: string;
          visibility?: Database["public"]["Enums"]["plaza_visibility"];
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          name?: string;
          posts_count?: number;
          required_post_permission?: string | null;
          rules?: string | null;
          slug?: string;
          sort_order?: number;
          status?: Database["public"]["Enums"]["plaza_status"];
          updated_at?: string;
          visibility?: Database["public"]["Enums"]["plaza_visibility"];
        };
        Relationships: [
          {
            foreignKeyName: "plazas_required_post_permission_fkey";
            columns: ["required_post_permission"];
            isOneToOne: false;
            referencedRelation: "permissions";
            referencedColumns: ["name"];
          },
        ];
      };
      post_tags: {
        Row: {
          post_id: string;
          tag_id: string;
        };
        Insert: {
          post_id: string;
          tag_id: string;
        };
        Update: {
          post_id?: string;
          tag_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "post_tags_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "posts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "post_tags_tag_id_fkey";
            columns: ["tag_id"];
            isOneToOne: false;
            referencedRelation: "tags";
            referencedColumns: ["id"];
          },
        ];
      };
      posts: {
        Row: {
          author_id: string;
          body: string;
          comments_count: number;
          created_at: string;
          dislikes_count: number;
          edit_locked: boolean;
          id: string;
          is_highlighted: boolean;
          is_pinned: boolean;
          likes_count: number;
          plaza_id: string;
          published_at: string | null;
          removed_at: string | null;
          status: Database["public"]["Enums"]["post_status"];
          title: string;
          updated_at: string;
        };
        Insert: {
          author_id: string;
          body: string;
          comments_count?: number;
          created_at?: string;
          dislikes_count?: number;
          edit_locked?: boolean;
          id?: string;
          is_highlighted?: boolean;
          is_pinned?: boolean;
          likes_count?: number;
          plaza_id: string;
          published_at?: string | null;
          removed_at?: string | null;
          status?: Database["public"]["Enums"]["post_status"];
          title: string;
          updated_at?: string;
        };
        Update: {
          author_id?: string;
          body?: string;
          comments_count?: number;
          created_at?: string;
          dislikes_count?: number;
          edit_locked?: boolean;
          id?: string;
          is_highlighted?: boolean;
          is_pinned?: boolean;
          likes_count?: number;
          plaza_id?: string;
          published_at?: string | null;
          removed_at?: string | null;
          status?: Database["public"]["Enums"]["post_status"];
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "posts_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "posts_plaza_id_fkey";
            columns: ["plaza_id"];
            isOneToOne: false;
            referencedRelation: "plazas";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_path: string | null;
          avatar_url: string | null;
          bio: string | null;
          created_at: string;
          display_name: string;
          id: string;
          profile_visibility: string;
          status: string;
          updated_at: string;
          website: string | null;
        };
        Insert: {
          avatar_path?: string | null;
          avatar_url?: string | null;
          bio?: string | null;
          created_at?: string;
          display_name: string;
          id: string;
          profile_visibility?: string;
          status?: string;
          updated_at?: string;
          website?: string | null;
        };
        Update: {
          avatar_path?: string | null;
          avatar_url?: string | null;
          bio?: string | null;
          created_at?: string;
          display_name?: string;
          id?: string;
          profile_visibility?: string;
          status?: string;
          updated_at?: string;
          website?: string | null;
        };
        Relationships: [];
      };
      ranks: {
        Row: {
          color: string | null;
          created_at: string;
          description: string | null;
          id: string;
          name: string;
          slug: string;
          sort_order: number;
          status: Database["public"]["Enums"]["rank_status"];
          updated_at: string;
        };
        Insert: {
          color?: string | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          name: string;
          slug: string;
          sort_order?: number;
          status?: Database["public"]["Enums"]["rank_status"];
          updated_at?: string;
        };
        Update: {
          color?: string | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          name?: string;
          slug?: string;
          sort_order?: number;
          status?: Database["public"]["Enums"]["rank_status"];
          updated_at?: string;
        };
        Relationships: [];
      };
      reactions: {
        Row: {
          affects_reputation: boolean;
          created_at: string;
          emoji: string;
          id: string;
          is_active: boolean;
          key: string;
          label: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          affects_reputation?: boolean;
          created_at?: string;
          emoji: string;
          id?: string;
          is_active?: boolean;
          key: string;
          label: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          affects_reputation?: boolean;
          created_at?: string;
          emoji?: string;
          id?: string;
          is_active?: boolean;
          key?: string;
          label?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      role_permissions: {
        Row: {
          id: string;
          permission_id: string;
          role_id: string;
        };
        Insert: {
          id?: string;
          permission_id: string;
          role_id: string;
        };
        Update: {
          id?: string;
          permission_id?: string;
          role_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey";
            columns: ["permission_id"];
            isOneToOne: false;
            referencedRelation: "permissions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey";
            columns: ["role_id"];
            isOneToOne: false;
            referencedRelation: "roles";
            referencedColumns: ["id"];
          },
        ];
      };
      roles: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          is_protected: boolean;
          name: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          is_protected?: boolean;
          name: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          is_protected?: boolean;
          name?: string;
        };
        Relationships: [];
      };
      site_settings: {
        Row: {
          created_at: string;
          description: string | null;
          is_public: boolean;
          key: string;
          max_value: number | null;
          min_value: number | null;
          updated_at: string;
          updated_by: string | null;
          value: Json;
          value_type: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          is_public?: boolean;
          key: string;
          max_value?: number | null;
          min_value?: number | null;
          updated_at?: string;
          updated_by?: string | null;
          value: Json;
          value_type: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          is_public?: boolean;
          key?: string;
          max_value?: number | null;
          min_value?: number | null;
          updated_at?: string;
          updated_by?: string | null;
          value?: Json;
          value_type?: string;
        };
        Relationships: [
          {
            foreignKeyName: "site_settings_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      tags: {
        Row: {
          created_at: string;
          id: string;
          label: string;
          slug: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          label: string;
          slug: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          label?: string;
          slug?: string;
        };
        Relationships: [];
      };
      user_badges: {
        Row: {
          badge_id: string;
          created_at: string;
          evidence_ref: string | null;
          evidence_visibility: Database["public"]["Enums"]["evidence_visibility"];
          id: string;
          issuer_id: string;
          reason: string;
          revoked_at: string | null;
          revoked_by: string | null;
          revoked_reason: string | null;
          status: Database["public"]["Enums"]["user_badge_status"];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          badge_id: string;
          created_at?: string;
          evidence_ref?: string | null;
          evidence_visibility?: Database["public"]["Enums"]["evidence_visibility"];
          id?: string;
          issuer_id: string;
          reason: string;
          revoked_at?: string | null;
          revoked_by?: string | null;
          revoked_reason?: string | null;
          status?: Database["public"]["Enums"]["user_badge_status"];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          badge_id?: string;
          created_at?: string;
          evidence_ref?: string | null;
          evidence_visibility?: Database["public"]["Enums"]["evidence_visibility"];
          id?: string;
          issuer_id?: string;
          reason?: string;
          revoked_at?: string | null;
          revoked_by?: string | null;
          revoked_reason?: string | null;
          status?: Database["public"]["Enums"]["user_badge_status"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_badges_badge_id_fkey";
            columns: ["badge_id"];
            isOneToOne: false;
            referencedRelation: "badges";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_badges_issuer_id_fkey";
            columns: ["issuer_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_badges_revoked_by_fkey";
            columns: ["revoked_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_badges_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      user_ranks: {
        Row: {
          assigned_at: string;
          assigned_by: string;
          created_at: string;
          id: string;
          rank_id: string;
          reason: string;
          user_id: string;
        };
        Insert: {
          assigned_at?: string;
          assigned_by: string;
          created_at?: string;
          id?: string;
          rank_id: string;
          reason: string;
          user_id: string;
        };
        Update: {
          assigned_at?: string;
          assigned_by?: string;
          created_at?: string;
          id?: string;
          rank_id?: string;
          reason?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_ranks_assigned_by_fkey";
            columns: ["assigned_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_ranks_rank_id_fkey";
            columns: ["rank_id"];
            isOneToOne: false;
            referencedRelation: "ranks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_ranks_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      user_roles: {
        Row: {
          assigned_at: string;
          assigned_by: string | null;
          id: string;
          role_id: string;
          user_id: string;
        };
        Insert: {
          assigned_at?: string;
          assigned_by?: string | null;
          id?: string;
          role_id: string;
          user_id: string;
        };
        Update: {
          assigned_at?: string;
          assigned_by?: string | null;
          id?: string;
          role_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_roles_role_id_fkey";
            columns: ["role_id"];
            isOneToOne: false;
            referencedRelation: "roles";
            referencedColumns: ["id"];
          },
        ];
      };
      user_warnings: {
        Row: {
          acknowledged_at: string | null;
          actor_id: string | null;
          created_at: string;
          id: string;
          reason: string;
          user_id: string;
        };
        Insert: {
          acknowledged_at?: string | null;
          actor_id?: string | null;
          created_at?: string;
          id?: string;
          reason: string;
          user_id: string;
        };
        Update: {
          acknowledged_at?: string | null;
          actor_id?: string | null;
          created_at?: string;
          id?: string;
          reason?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_warnings_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_warnings_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      acknowledge_warning: {
        Args: { p_warning_id: string };
        Returns: {
          warning_id: string;
        }[];
      };
      add_chat_codex_proposal_source: {
        Args: {
          p_chat_message_id: string;
          p_note?: string;
          p_proposal_id: string;
        };
        Returns: {
          source_id: string;
        }[];
      };
      add_codex_proposal_source: {
        Args: {
          p_comment_id?: string;
          p_external_url?: string;
          p_note?: string;
          p_post_id?: string;
          p_proposal_id: string;
          p_source_type: Database["public"]["Enums"]["codex_source_type"];
        };
        Returns: {
          source_id: string;
        }[];
      };
      admin_add_chat_channel_member: {
        Args: { p_channel_id: string; p_member_id: string; p_remove?: boolean };
        Returns: {
          channel_member_id: string;
        }[];
      };
      admin_create_chat_channel: {
        Args: {
          p_clan_id?: string;
          p_description?: string;
          p_kind?: Database["public"]["Enums"]["chat_channel_kind"];
          p_name: string;
          p_slug: string;
          p_sort_order?: number;
        };
        Returns: {
          channel_id: string;
        }[];
      };
      admin_create_clan: {
        Args: {
          p_description?: string;
          p_leader_id: string;
          p_mission?: string;
          p_name: string;
          p_privacy?: Database["public"]["Enums"]["clan_privacy"];
          p_slug: string;
        };
        Returns: {
          clan_id: string;
        }[];
      };
      admin_create_plaza: {
        Args: {
          p_description?: string;
          p_name: string;
          p_required_post_permission?: string;
          p_slug: string;
          p_sort_order?: number;
          p_visibility?: Database["public"]["Enums"]["plaza_visibility"];
        };
        Returns: {
          plaza_id: string;
        }[];
      };
      admin_get_site_settings: {
        Args: never;
        Returns: {
          description: string;
          is_public: boolean;
          key: string;
          max_value: number;
          min_value: number;
          updated_at: string;
          updated_by: string;
          updated_by_display_name: string;
          value: Json;
          value_type: string;
        }[];
      };
      admin_list_chat_channels: {
        Args: never;
        Returns: {
          clan_id: string;
          description: string;
          id: string;
          kind: Database["public"]["Enums"]["chat_channel_kind"];
          name: string;
          slug: string;
          sort_order: number;
          status: Database["public"]["Enums"]["chat_channel_status"];
        }[];
      };
      admin_list_reaction_types: {
        Args: never;
        Returns: {
          affects_reputation: boolean;
          created_at: string;
          emoji: string;
          is_active: boolean;
          key: string;
          label: string;
          sort_order: number;
        }[];
      };
      admin_set_badge_status: {
        Args: {
          p_expected_status: Database["public"]["Enums"]["badge_status"];
          p_reason: string;
          p_slug: string;
          p_status: Database["public"]["Enums"]["badge_status"];
        };
        Returns: {
          badge_slug: string;
        }[];
      };
      admin_set_chat_channel_status: {
        Args: {
          p_channel_id: string;
          p_expected_status: Database["public"]["Enums"]["chat_channel_status"];
          p_reason: string;
          p_status: Database["public"]["Enums"]["chat_channel_status"];
        };
        Returns: {
          channel_id: string;
        }[];
      };
      admin_set_clan_status: {
        Args: {
          p_clan_id: string;
          p_expected_status: Database["public"]["Enums"]["clan_status"];
          p_reason: string;
          p_status: Database["public"]["Enums"]["clan_status"];
        };
        Returns: {
          clan_id: string;
        }[];
      };
      admin_set_codex_category_status: {
        Args: {
          p_expected_status: string;
          p_reason: string;
          p_slug: string;
          p_status: string;
        };
        Returns: {
          category_slug: string;
        }[];
      };
      admin_set_plaza_status: {
        Args: {
          p_expected_status: Database["public"]["Enums"]["plaza_status"];
          p_plaza_id: string;
          p_reason: string;
          p_status: Database["public"]["Enums"]["plaza_status"];
        };
        Returns: {
          plaza_id: string;
        }[];
      };
      admin_set_rank_status: {
        Args: {
          p_expected_status: Database["public"]["Enums"]["rank_status"];
          p_reason: string;
          p_slug: string;
          p_status: Database["public"]["Enums"]["rank_status"];
        };
        Returns: {
          rank_slug: string;
        }[];
      };
      admin_set_reaction_type_active: {
        Args: {
          p_expected_active: boolean;
          p_is_active: boolean;
          p_key: string;
          p_reason: string;
        };
        Returns: {
          reaction_key: string;
        }[];
      };
      admin_set_site_setting: {
        Args: {
          p_expected_value?: Json;
          p_key: string;
          p_reason?: string;
          p_value: Json;
        };
        Returns: {
          setting_key: string;
        }[];
      };
      admin_update_chat_channel: {
        Args: {
          p_channel_id: string;
          p_description: string;
          p_name: string;
          p_sort_order: number;
        };
        Returns: {
          channel_id: string;
        }[];
      };
      admin_update_clan: {
        Args: {
          p_clan_id: string;
          p_description: string;
          p_mission: string;
          p_name: string;
          p_privacy: Database["public"]["Enums"]["clan_privacy"];
        };
        Returns: {
          clan_id: string;
        }[];
      };
      admin_update_plaza:
        | {
            Args: {
              p_description: string;
              p_name: string;
              p_plaza_id: string;
              p_required_post_permission?: string;
              p_rules: string;
              p_slug: string;
              p_sort_order: number;
              p_visibility: Database["public"]["Enums"]["plaza_visibility"];
            };
            Returns: {
              plaza_id: string;
            }[];
          }
        | {
            Args: {
              p_clear_post_permission?: boolean;
              p_description: string;
              p_name: string;
              p_plaza_id: string;
              p_required_post_permission?: string;
              p_rules: string;
              p_slug: string;
              p_sort_order: number;
              p_visibility: Database["public"]["Enums"]["plaza_visibility"];
            };
            Returns: {
              plaza_id: string;
            }[];
          };
      admin_upsert_badge: {
        Args: {
          p_description?: string;
          p_name: string;
          p_required_issuer_permission?: string;
          p_slug: string;
          p_sort_order?: number;
        };
        Returns: {
          badge_slug: string;
        }[];
      };
      admin_upsert_codex_category: {
        Args: {
          p_description?: string;
          p_name: string;
          p_slug: string;
          p_sort_order?: number;
        };
        Returns: {
          category_slug: string;
        }[];
      };
      admin_upsert_rank: {
        Args: {
          p_color?: string;
          p_description?: string;
          p_name: string;
          p_slug: string;
          p_sort_order?: number;
        };
        Returns: {
          rank_slug: string;
        }[];
      };
      admin_upsert_reaction_type: {
        Args: {
          p_affects_reputation?: boolean;
          p_emoji: string;
          p_key: string;
          p_label: string;
          p_sort_order?: number;
        };
        Returns: {
          reaction_key: string;
        }[];
      };
      assign_clan_internal_role: {
        Args: {
          p_clan_id: string;
          p_internal_role_id: string;
          p_member_id: string;
          p_remove?: boolean;
        };
        Returns: {
          assignment_id: string;
        }[];
      };
      assign_codex_proposal: {
        Args: { p_assignee_id: string; p_proposal_id: string; p_reason: string };
        Returns: {
          proposal_id: string;
        }[];
      };
      assign_rank: {
        Args: { p_rank_slug: string; p_reason: string; p_user_id: string };
        Returns: {
          user_rank_id: string;
        }[];
      };
      award_badge: {
        Args: {
          p_badge_slug: string;
          p_evidence_ref?: string;
          p_evidence_visibility?: Database["public"]["Enums"]["evidence_visibility"];
          p_reason: string;
          p_user_id: string;
        };
        Returns: {
          user_badge_id: string;
        }[];
      };
      block_user: {
        Args: { p_blocked_id: string; p_reason?: string };
        Returns: {
          block_id: string;
        }[];
      };
      cancel_friend_request: {
        Args: { p_friendship_id: string };
        Returns: {
          friendship_id: string;
        }[];
      };
      council_add_user_note: {
        Args: { p_body: string; p_user_id: string };
        Returns: {
          note_id: string;
        }[];
      };
      council_assign_user_role: {
        Args: { p_reason: string; p_role_id: string; p_user_id: string };
        Returns: string;
      };
      council_delete_user_note: {
        Args: { p_note_id: string };
        Returns: {
          note_id: string;
        }[];
      };
      council_get_user: {
        Args: { p_user_id: string };
        Returns: {
          avatar_path: string;
          bio: string;
          created_at: string;
          display_name: string;
          id: string;
          roles: Json;
          status: string;
          website: string;
        }[];
      };
      council_list_audit_logs: {
        Args: {
          p_action?: string;
          p_actor_id?: string;
          p_created_before?: string;
          p_created_from?: string;
          p_limit?: number;
          p_offset?: number;
          p_target_id?: string;
        };
        Returns: {
          action: string;
          actor_display_name: string;
          actor_id: string;
          created_at: string;
          id: string;
          new_status: string;
          old_status: string;
          reason: string;
          role_name: string;
          target_display_name: string;
          target_id: string;
          target_type: string;
          total_count: number;
        }[];
      };
      council_list_user_notes: {
        Args: {
          p_cursor_created_at?: string;
          p_cursor_id?: string;
          p_limit?: number;
          p_user_id: string;
        };
        Returns: {
          actor_display_name: string;
          actor_id: string;
          body: string;
          created_at: string;
          note_id: string;
          updated_at: string;
        }[];
      };
      council_list_users: {
        Args: {
          p_limit?: number;
          p_offset?: number;
          p_search?: string;
          p_sort?: string;
          p_status?: string;
        };
        Returns: {
          avatar_path: string;
          created_at: string;
          display_name: string;
          id: string;
          role_names: string[];
          status: string;
          total_count: number;
        }[];
      };
      council_remove_user_role: {
        Args: { p_reason: string; p_role_id: string; p_user_id: string };
        Returns: string;
      };
      council_set_user_status:
        | {
            Args: {
              p_expected_status: string;
              p_reason: string;
              p_status: string;
              p_user_id: string;
            };
            Returns: string;
          }
        | {
            Args: { p_reason: string; p_status: string; p_user_id: string };
            Returns: string;
          };
      count_author_posts: { Args: { p_author_id: string }; Returns: number };
      create_appeal: {
        Args: { p_audit_log_id: string; p_body: string };
        Returns: {
          appeal_id: string;
        }[];
      };
      create_codex_article: {
        Args: {
          p_body: string;
          p_category_slug: string;
          p_excerpt?: string;
          p_slug?: string;
          p_title: string;
        };
        Returns: {
          article_id: string;
        }[];
      };
      create_codex_proposal: {
        Args: {
          p_comment_id?: string;
          p_external_url?: string;
          p_post_id?: string;
          p_reason: string;
          p_working_title?: string;
        };
        Returns: {
          proposal_id: string;
        }[];
      };
      create_codex_proposal_from_chat: {
        Args: {
          p_chat_message_id: string;
          p_reason: string;
          p_working_title?: string;
        };
        Returns: {
          proposal_id: string;
        }[];
      };
      create_codex_suggestion: {
        Args: { p_article_id: string; p_body: string };
        Returns: {
          suggestion_id: string;
        }[];
      };
      create_comment: {
        Args: { p_body: string; p_parent_id?: string; p_post_id: string };
        Returns: {
          comment_id: string;
        }[];
      };
      create_post: {
        Args: {
          p_body: string;
          p_plaza_id: string;
          p_publish?: boolean;
          p_title: string;
        };
        Returns: {
          post_id: string;
        }[];
      };
      create_report: {
        Args: {
          p_comment_id?: string;
          p_details?: string;
          p_post_id?: string;
          p_profile_id?: string;
          p_reason: Database["public"]["Enums"]["report_reason"];
        };
        Returns: {
          report_id: string;
        }[];
      };
      current_user_permissions: {
        Args: never;
        Returns: {
          permission_name: string;
        }[];
      };
      delete_own_chat_message: {
        Args: { p_message_id: string };
        Returns: {
          message_id: string;
        }[];
      };
      delete_own_comment: {
        Args: { p_comment_id: string };
        Returns: {
          comment_id: string;
        }[];
      };
      delete_own_post: {
        Args: { p_post_id: string };
        Returns: {
          post_id: string;
        }[];
      };
      expel_clan_member: {
        Args: { p_clan_id: string; p_member_id: string; p_reason: string };
        Returns: {
          membership_id: string;
        }[];
      };
      get_article_provenance: {
        Args: { p_article_id: string };
        Returns: {
          added_at: string;
          attribution: Database["public"]["Enums"]["codex_attribution"];
          contribution_type: Database["public"]["Enums"]["codex_contribution_type"];
          contributor_id: string;
          kind: string;
          member_display_name: string;
          member_id: string;
          source_id: string;
          source_is_visible: boolean;
          source_label: string;
          source_note: string;
          source_type: Database["public"]["Enums"]["codex_source_type"];
        }[];
      };
      get_chat_channel: {
        Args: { p_slug: string };
        Returns: {
          can_announce: boolean;
          can_send: boolean;
          clan_id: string;
          description: string;
          id: string;
          kind: Database["public"]["Enums"]["chat_channel_kind"];
          name: string;
          slug: string;
          status: Database["public"]["Enums"]["chat_channel_status"];
        }[];
      };
      get_clan: {
        Args: { p_slug: string };
        Returns: {
          caller_is_member: boolean;
          caller_role: Database["public"]["Enums"]["clan_member_role"];
          can_manage: boolean;
          description: string;
          emblem_path: string;
          id: string;
          leader_display_name: string;
          leader_id: string;
          member_count: number;
          mission: string;
          name: string;
          privacy: Database["public"]["Enums"]["clan_privacy"];
          slug: string;
          status: Database["public"]["Enums"]["clan_status"];
        }[];
      };
      get_codex_article: {
        Args: { p_slug: string };
        Returns: {
          author_display_name: string;
          author_id: string;
          body: string;
          caller_bookmarked: boolean;
          can_edit: boolean;
          can_publish: boolean;
          category_name: string;
          category_slug: string;
          excerpt: string;
          id: string;
          published_at: string;
          slug: string;
          status: Database["public"]["Enums"]["codex_article_status"];
          suggestion_count: number;
          title: string;
          updated_at: string;
          version: number;
        }[];
      };
      get_codex_proposal: {
        Args: { p_proposal_id: string };
        Returns: {
          article_id: string;
          article_slug: string;
          assignee_display_name: string;
          assignee_id: string;
          can_edit: boolean;
          contributor_count: number;
          created_at: string;
          proposal_id: string;
          proposer_display_name: string;
          proposer_id: string;
          reason: string;
          replaced_by: string;
          source_count: number;
          status: Database["public"]["Enums"]["codex_proposal_status"];
          updated_at: string;
          working_title: string;
        }[];
      };
      get_member_profile: {
        Args: { p_user_id: string };
        Returns: {
          avatar_path: string;
          bio: string;
          created_at: string;
          display_name: string;
          id: string;
          role_names: string[];
          updated_at: string;
          website: string;
        }[];
      };
      get_notification_preferences: {
        Args: never;
        Returns: {
          types: Json;
        }[];
      };
      get_plaza: {
        Args: { p_slug: string };
        Returns: {
          can_post: boolean;
          description: string;
          id: string;
          name: string;
          posts_count: number;
          rules: string;
          slug: string;
          status: Database["public"]["Enums"]["plaza_status"];
          visibility: Database["public"]["Enums"]["plaza_visibility"];
        }[];
      };
      get_post: {
        Args: { p_post_id: string };
        Returns: {
          accepts_comments: boolean;
          author_display_name: string;
          author_id: string;
          body: string;
          caller_bookmarked: boolean;
          caller_vote: number;
          can_edit: boolean;
          comments_count: number;
          created_at: string;
          dislikes_count: number;
          edit_locked: boolean;
          id: string;
          is_highlighted: boolean;
          is_pinned: boolean;
          likes_count: number;
          plaza_id: string;
          plaza_name: string;
          plaza_slug: string;
          status: Database["public"]["Enums"]["post_status"];
          tag_slugs: string[];
          title: string;
          updated_at: string;
        }[];
      };
      get_profile_rank: {
        Args: { p_user_id: string };
        Returns: {
          assigned_at: string;
          color: string;
          name: string;
          rank_id: string;
          slug: string;
        }[];
      };
      get_site_settings: {
        Args: never;
        Returns: {
          description: string;
          key: string;
          value: Json;
          value_type: string;
        }[];
      };
      invite_to_clan: {
        Args: { p_clan_id: string; p_member_id: string; p_note?: string };
        Returns: {
          membership_id: string;
        }[];
      };
      leave_clan: {
        Args: { p_clan_id: string; p_reason?: string };
        Returns: {
          membership_id: string;
        }[];
      };
      list_chat_channel_members: {
        Args: { p_channel_id: string };
        Returns: {
          added_at: string;
          display_name: string;
          member_id: string;
        }[];
      };
      list_chat_channels: {
        Args: never;
        Returns: {
          clan_id: string;
          description: string;
          id: string;
          kind: Database["public"]["Enums"]["chat_channel_kind"];
          name: string;
          slug: string;
          sort_order: number;
        }[];
      };
      list_chat_message_edits: {
        Args: { p_limit?: number; p_message_id: string };
        Returns: {
          created_at: string;
          edit_id: string;
          editor_display_name: string;
          old_body: string;
        }[];
      };
      list_chat_messages: {
        Args: {
          p_channel_id: string;
          p_cursor_created_at?: string;
          p_cursor_id?: string;
          p_limit?: number;
          p_pinned_only?: boolean;
        };
        Returns: {
          author_display_name: string;
          author_id: string;
          body: string;
          caller_reacted: Json;
          created_at: string;
          edited_at: string;
          id: string;
          is_pinned: boolean;
          parent_id: string;
          reaction_counts: Json;
          replies_count: number;
          status: Database["public"]["Enums"]["chat_message_status"];
        }[];
      };
      list_clan_internal_roles: {
        Args: { p_clan_id: string };
        Returns: {
          description: string;
          internal_role_id: string;
          member_count: number;
          name: string;
          permissions: string[];
        }[];
      };
      list_clan_members: {
        Args: { p_clan_id: string; p_limit?: number };
        Returns: {
          display_name: string;
          joined_at: string;
          member_id: string;
          role: Database["public"]["Enums"]["clan_member_role"];
        }[];
      };
      list_clans: {
        Args: never;
        Returns: {
          caller_is_member: boolean;
          caller_role: Database["public"]["Enums"]["clan_member_role"];
          description: string;
          emblem_path: string;
          id: string;
          leader_display_name: string;
          leader_id: string;
          member_count: number;
          mission: string;
          name: string;
          privacy: Database["public"]["Enums"]["clan_privacy"];
          slug: string;
        }[];
      };
      list_codex_articles: {
        Args: {
          p_category_slug?: string;
          p_cursor_created_at?: string;
          p_cursor_id?: string;
          p_limit?: number;
        };
        Returns: {
          author_display_name: string;
          author_id: string;
          category_name: string;
          category_slug: string;
          created_at: string;
          excerpt: string;
          id: string;
          published_at: string;
          slug: string;
          title: string;
          version: number;
        }[];
      };
      list_codex_articles_for_review: {
        Args: {
          p_cursor_created_at?: string;
          p_cursor_id?: string;
          p_limit?: number;
          p_status?: Database["public"]["Enums"]["codex_article_status"];
        };
        Returns: {
          author_display_name: string;
          author_id: string;
          category_name: string;
          category_slug: string;
          created_at: string;
          excerpt: string;
          id: string;
          published_at: string;
          slug: string;
          status: Database["public"]["Enums"]["codex_article_status"];
          title: string;
          version: number;
        }[];
      };
      list_codex_categories:
        | {
            Args: never;
            Returns: {
              description: string;
              id: string;
              name: string;
              slug: string;
              sort_order: number;
            }[];
          }
        | {
            Args: { p_include_archived: boolean };
            Returns: {
              description: string;
              id: string;
              name: string;
              slug: string;
              sort_order: number;
              status: string;
            }[];
          };
      list_codex_proposal_contributors: {
        Args: { p_limit?: number; p_proposal_id: string };
        Returns: {
          attribution: Database["public"]["Enums"]["codex_attribution"];
          confirmed_at: string;
          confirmed_by: string;
          contribution_type: Database["public"]["Enums"]["codex_contribution_type"];
          contributor_id: string;
          created_at: string;
          evidence_ref: string;
          member_display_name: string;
          member_id: string;
          status: Database["public"]["Enums"]["codex_contribution_status"];
        }[];
      };
      list_codex_proposal_sources: {
        Args: { p_limit?: number; p_proposal_id: string };
        Returns: {
          added_at: string;
          added_by: string;
          added_by_display_name: string;
          is_visible: boolean;
          label: string;
          note: string;
          source_id: string;
          source_type: Database["public"]["Enums"]["codex_source_type"];
        }[];
      };
      list_codex_versions: {
        Args: { p_article_id: string; p_limit?: number };
        Returns: {
          body: string;
          change_summary: string;
          created_at: string;
          editor_display_name: string;
          editor_id: string;
          seq: number;
          title: string;
          version: number;
          version_id: string;
        }[];
      };
      list_content_revisions: {
        Args: { p_comment_id?: string; p_limit?: number; p_post_id?: string };
        Returns: {
          body: string;
          created_at: string;
          editor_display_name: string;
          editor_id: string;
          revision_id: string;
          title: string;
        }[];
      };
      list_friends: {
        Args: { p_limit?: number; p_user_id?: string };
        Returns: {
          avatar_path: string;
          display_name: string;
          friend_id: string;
          friends_since: string;
        }[];
      };
      list_member_profiles: {
        Args: { p_limit?: number; p_offset?: number; p_search?: string };
        Returns: {
          avatar_path: string;
          bio: string;
          created_at: string;
          display_name: string;
          id: string;
          role_names: string[];
          total_count: number;
          website: string;
        }[];
      };
      list_own_appeals: {
        Args: never;
        Returns: {
          action: string;
          appeal_id: string;
          audit_log_id: string;
          body: string;
          created_at: string;
          decided_at: string;
          decision: string;
          status: Database["public"]["Enums"]["appeal_status"];
        }[];
      };
      list_own_blocks: {
        Args: never;
        Returns: {
          blocked_at: string;
          blocked_id: string;
          display_name: string;
        }[];
      };
      list_own_bookmarks: {
        Args: {
          p_cursor_created_at?: string;
          p_cursor_id?: string;
          p_limit?: number;
        };
        Returns: {
          author_display_name: string;
          bookmark_id: string;
          bookmarked_at: string;
          plaza_slug: string;
          post_id: string;
          title: string;
        }[];
      };
      list_own_codex_bookmarks: {
        Args: {
          p_cursor_created_at?: string;
          p_cursor_id?: string;
          p_limit?: number;
        };
        Returns: {
          article_id: string;
          author_display_name: string;
          bookmark_id: string;
          bookmarked_at: string;
          category_slug: string;
          slug: string;
          title: string;
        }[];
      };
      list_own_codex_proposals: {
        Args: {
          p_limit?: number;
          p_status?: Database["public"]["Enums"]["codex_proposal_status"];
        };
        Returns: {
          article_id: string;
          article_slug: string;
          created_at: string;
          proposal_id: string;
          reason: string;
          status: Database["public"]["Enums"]["codex_proposal_status"];
          updated_at: string;
          working_title: string;
        }[];
      };
      list_own_codex_suggestions: {
        Args: { p_article_id?: string; p_limit?: number };
        Returns: {
          article_id: string;
          article_slug: string;
          article_title: string;
          body: string;
          created_at: string;
          review_note: string;
          reviewed_at: string;
          status: Database["public"]["Enums"]["codex_suggestion_status"];
          suggestion_id: string;
        }[];
      };
      list_own_friend_requests: {
        Args: never;
        Returns: {
          created_at: string;
          direction: string;
          friendship_id: string;
          peer_display_name: string;
          peer_id: string;
        }[];
      };
      list_own_moderation_actions: {
        Args: { p_limit?: number };
        Returns: {
          action: string;
          appeal_id: string;
          appeal_status: Database["public"]["Enums"]["appeal_status"];
          audit_log_id: string;
          created_at: string;
          reason: string;
        }[];
      };
      list_own_notifications: {
        Args: {
          p_cursor_created_at?: string;
          p_cursor_id?: string;
          p_limit?: number;
          p_unread_only?: boolean;
        };
        Returns: {
          actor_display_name: string;
          actor_id: string;
          created_at: string;
          notification_id: string;
          payload: Json;
          read_at: string;
          type: Database["public"]["Enums"]["notification_type"];
        }[];
      };
      list_own_warnings: {
        Args: never;
        Returns: {
          acknowledged_at: string;
          created_at: string;
          reason: string;
          warning_id: string;
        }[];
      };
      list_plazas: {
        Args: never;
        Returns: {
          description: string;
          id: string;
          name: string;
          posts_count: number;
          slug: string;
          sort_order: number;
          status: Database["public"]["Enums"]["plaza_status"];
          visibility: Database["public"]["Enums"]["plaza_visibility"];
        }[];
      };
      list_post_comments: {
        Args: {
          p_cursor_created_at?: string;
          p_cursor_id?: string;
          p_limit?: number;
          p_post_id: string;
        };
        Returns: {
          author_display_name: string;
          author_id: string;
          body: string;
          caller_vote: number;
          can_edit: boolean;
          can_reply: boolean;
          created_at: string;
          depth: number;
          dislikes_count: number;
          id: string;
          is_pinned: boolean;
          is_removed: boolean;
          likes_count: number;
          parent_id: string;
          post_id: string;
          replies_count: number;
          replies_locked: boolean;
          status: Database["public"]["Enums"]["comment_status"];
          updated_at: string;
        }[];
      };
      list_posts: {
        Args: {
          p_cursor_created_at?: string;
          p_cursor_id?: string;
          p_cursor_score?: number;
          p_limit?: number;
          p_order?: string;
          p_plaza_id?: string;
          p_tag_slug?: string;
        };
        Returns: {
          author_display_name: string;
          author_id: string;
          comments_count: number;
          created_at: string;
          dislikes_count: number;
          excerpt: string;
          id: string;
          is_highlighted: boolean;
          is_pinned: boolean;
          likes_count: number;
          plaza_id: string;
          plaza_name: string;
          plaza_slug: string;
          score: number;
          status: Database["public"]["Enums"]["post_status"];
          title: string;
        }[];
      };
      list_posts_by_author: {
        Args: {
          p_author_id: string;
          p_cursor_created_at?: string;
          p_cursor_id?: string;
          p_limit?: number;
        };
        Returns: {
          author_display_name: string;
          author_id: string;
          comments_count: number;
          created_at: string;
          dislikes_count: number;
          excerpt: string;
          id: string;
          is_highlighted: boolean;
          is_pinned: boolean;
          likes_count: number;
          plaza_id: string;
          plaza_name: string;
          plaza_slug: string;
          score: number;
          status: Database["public"]["Enums"]["post_status"];
          title: string;
        }[];
      };
      list_profile_badges: {
        Args: { p_include_private?: boolean; p_user_id: string };
        Returns: {
          awarded_at: string;
          badge_id: string;
          description: string;
          evidence_ref: string;
          evidence_visibility: Database["public"]["Enums"]["evidence_visibility"];
          issuer_display_name: string;
          issuer_id: string;
          name: string;
          reason: string;
          revoked_at: string;
          revoked_reason: string;
          slug: string;
          status: Database["public"]["Enums"]["user_badge_status"];
        }[];
      };
      list_ranks: {
        Args: never;
        Returns: {
          color: string;
          description: string;
          id: string;
          name: string;
          slug: string;
          sort_order: number;
          status: Database["public"]["Enums"]["rank_status"];
        }[];
      };
      list_reaction_types: {
        Args: never;
        Returns: {
          emoji: string;
          key: string;
          label: string;
          sort_order: number;
        }[];
      };
      mark_all_notifications_read: {
        Args: never;
        Returns: {
          updated: number;
        }[];
      };
      mark_notification_read: {
        Args: { p_notification_id: string };
        Returns: {
          notification_id: string;
        }[];
      };
      moderation_claim_appeal: {
        Args: {
          p_appeal_id: string;
          p_expected_status: Database["public"]["Enums"]["appeal_status"];
        };
        Returns: {
          appeal_id: string;
        }[];
      };
      moderation_get_appeal: {
        Args: { p_appeal_id: string };
        Returns: {
          action: string;
          action_actor_display_name: string;
          action_actor_id: string;
          action_created_at: string;
          action_reason: string;
          appeal_id: string;
          appellant_display_name: string;
          appellant_id: string;
          audit_log_id: string;
          body: string;
          created_at: string;
          decided_at: string;
          decided_by: string;
          decision: string;
          status: Database["public"]["Enums"]["appeal_status"];
        }[];
      };
      moderation_get_report: {
        Args: { p_report_id: string };
        Returns: {
          created_at: string;
          details: string;
          reason: Database["public"]["Enums"]["report_reason"];
          report_id: string;
          reporter_display_name: string;
          reporter_id: string;
          resolution: string;
          resolved_at: string;
          resolved_by: string;
          status: Database["public"]["Enums"]["report_status"];
          target_author_display_name: string;
          target_author_id: string;
          target_body: string;
          target_id: string;
          target_status: string;
          target_type: string;
        }[];
      };
      moderation_list_appeals: {
        Args: {
          p_cursor_created_at?: string;
          p_cursor_id?: string;
          p_limit?: number;
          p_status?: Database["public"]["Enums"]["appeal_status"];
        };
        Returns: {
          action: string;
          appeal_id: string;
          appellant_display_name: string;
          appellant_id: string;
          audit_log_id: string;
          created_at: string;
          status: Database["public"]["Enums"]["appeal_status"];
        }[];
      };
      moderation_list_codex_proposals: {
        Args: {
          p_cursor_created_at?: string;
          p_cursor_id?: string;
          p_limit?: number;
          p_status?: Database["public"]["Enums"]["codex_proposal_status"];
        };
        Returns: {
          assignee_display_name: string;
          assignee_id: string;
          created_at: string;
          proposal_id: string;
          proposer_display_name: string;
          proposer_id: string;
          reason: string;
          source_count: number;
          status: Database["public"]["Enums"]["codex_proposal_status"];
        }[];
      };
      moderation_list_codex_suggestions: {
        Args: {
          p_cursor_created_at?: string;
          p_cursor_id?: string;
          p_limit?: number;
          p_status?: Database["public"]["Enums"]["codex_suggestion_status"];
        };
        Returns: {
          article_id: string;
          article_slug: string;
          article_title: string;
          body: string;
          created_at: string;
          status: Database["public"]["Enums"]["codex_suggestion_status"];
          suggester_display_name: string;
          suggester_id: string;
          suggestion_id: string;
        }[];
      };
      moderation_list_reports: {
        Args: {
          p_cursor_created_at?: string;
          p_cursor_id?: string;
          p_limit?: number;
          p_status?: Database["public"]["Enums"]["report_status"];
        };
        Returns: {
          created_at: string;
          details: string;
          open_report_count: number;
          reason: Database["public"]["Enums"]["report_reason"];
          report_id: string;
          reporter_display_name: string;
          reporter_id: string;
          resolution: string;
          resolved_at: string;
          resolved_by: string;
          status: Database["public"]["Enums"]["report_status"];
          target_author_display_name: string;
          target_author_id: string;
          target_excerpt: string;
          target_id: string;
          target_type: string;
        }[];
      };
      moderation_move_post: {
        Args: { p_plaza_id: string; p_post_id: string; p_reason: string };
        Returns: {
          post_id: string;
        }[];
      };
      moderation_mute_chat_user: {
        Args: {
          p_duration_minutes?: number;
          p_reason: string;
          p_user_id: string;
        };
        Returns: {
          expires_at: string;
          mute_id: string;
        }[];
      };
      moderation_resolve_appeal: {
        Args: {
          p_appeal_id: string;
          p_decision: string;
          p_expected_status: Database["public"]["Enums"]["appeal_status"];
          p_status: Database["public"]["Enums"]["appeal_status"];
        };
        Returns: {
          appeal_id: string;
        }[];
      };
      moderation_set_chat_message_status: {
        Args: {
          p_expected_status: Database["public"]["Enums"]["chat_message_status"];
          p_message_id: string;
          p_reason: string;
          p_status: Database["public"]["Enums"]["chat_message_status"];
        };
        Returns: {
          message_id: string;
        }[];
      };
      moderation_set_comment_flags: {
        Args: {
          p_comment_id: string;
          p_is_pinned?: boolean;
          p_reason: string;
          p_replies_locked?: boolean;
        };
        Returns: {
          comment_id: string;
        }[];
      };
      moderation_set_comment_status: {
        Args: {
          p_comment_id: string;
          p_expected_status: Database["public"]["Enums"]["comment_status"];
          p_reason: string;
          p_status: Database["public"]["Enums"]["comment_status"];
        };
        Returns: {
          comment_id: string;
        }[];
      };
      moderation_set_post_flags: {
        Args: {
          p_edit_locked?: boolean;
          p_is_highlighted?: boolean;
          p_is_pinned?: boolean;
          p_post_id: string;
          p_reason: string;
        };
        Returns: {
          post_id: string;
        }[];
      };
      moderation_set_post_status: {
        Args: {
          p_expected_status: Database["public"]["Enums"]["post_status"];
          p_post_id: string;
          p_reason: string;
          p_status: Database["public"]["Enums"]["post_status"];
        };
        Returns: {
          post_id: string;
        }[];
      };
      moderation_set_report_status: {
        Args: {
          p_expected_status: Database["public"]["Enums"]["report_status"];
          p_report_id: string;
          p_resolution?: string;
          p_status: Database["public"]["Enums"]["report_status"];
        };
        Returns: {
          report_id: string;
        }[];
      };
      moderation_toggle_chat_message_pin: {
        Args: {
          p_expected_pinned: boolean;
          p_is_pinned: boolean;
          p_message_id: string;
        };
        Returns: {
          message_id: string;
        }[];
      };
      moderation_unmute_chat_user: {
        Args: { p_reason: string; p_user_id: string };
        Returns: {
          mute_id: string;
        }[];
      };
      moderation_warn_user: {
        Args: { p_reason: string; p_user_id: string };
        Returns: {
          warning_id: string;
        }[];
      };
      outbox_consume: {
        Args: { p_event_id: string };
        Returns: {
          created_notification: boolean;
          event_id: string;
          status: Database["public"]["Enums"]["outbox_status"];
        }[];
      };
      outbox_fail: {
        Args: { p_error: string; p_event_id: string };
        Returns: {
          event_id: string;
          status: Database["public"]["Enums"]["outbox_status"];
        }[];
      };
      outbox_list_failed: {
        Args: { p_limit?: number };
        Returns: {
          aggregate_id: string;
          aggregate_type: string;
          attempts: number;
          created_at: string;
          event_id: string;
          event_type: string;
          last_error: string;
          payload: Json;
        }[];
      };
      outbox_list_ready: {
        Args: { p_limit?: number };
        Returns: {
          aggregate_id: string;
          aggregate_type: string;
          attempts: number;
          created_at: string;
          event_id: string;
          event_type: string;
          next_attempt_at: string;
          payload: Json;
        }[];
      };
      outbox_reprocess: {
        Args: { p_event_id: string };
        Returns: {
          event_id: string;
          status: Database["public"]["Enums"]["outbox_status"];
        }[];
      };
      post_chat_announcement: {
        Args: { p_body: string; p_channel_id: string };
        Returns: {
          message_id: string;
        }[];
      };
      process_pending_outbox: {
        Args: { p_limit?: number };
        Returns: {
          processed: number;
        }[];
      };
      publish_codex_article: {
        Args: {
          p_article_id: string;
          p_change_summary?: string;
          p_expected_status?: Database["public"]["Enums"]["codex_article_status"];
        };
        Returns: {
          article_id: string;
        }[];
      };
      remove_clan_internal_role: {
        Args: { p_clan_id: string; p_internal_role_id: string };
        Returns: {
          internal_role_id: string;
        }[];
      };
      remove_codex_proposal_source: {
        Args: { p_proposal_id: string; p_source_id: string };
        Returns: {
          source_id: string;
        }[];
      };
      remove_friend: {
        Args: { p_friendship_id: string };
        Returns: {
          friendship_id: string;
        }[];
      };
      remove_rank: {
        Args: { p_reason: string; p_user_id: string };
        Returns: {
          removed: boolean;
        }[];
      };
      replace_codex_proposal: {
        Args: { p_proposal_id: string; p_reason: string; p_replaced_by: string };
        Returns: {
          proposal_id: string;
        }[];
      };
      report_chat_message: {
        Args: {
          p_details?: string;
          p_message_id: string;
          p_reason: Database["public"]["Enums"]["report_reason"];
        };
        Returns: {
          report_id: string;
        }[];
      };
      request_clan_membership: {
        Args: { p_clan_id: string };
        Returns: {
          membership_id: string;
          status: Database["public"]["Enums"]["clan_member_status"];
        }[];
      };
      reset_clan_emblem: {
        Args: { p_clan_id: string; p_expected_path: string };
        Returns: boolean;
      };
      reset_profile_avatar: {
        Args: { p_expected_path: string };
        Returns: boolean;
      };
      respond_friend_request: {
        Args: { p_accept: boolean; p_friendship_id: string };
        Returns: {
          friendship_id: string;
          status: Database["public"]["Enums"]["friendship_status"];
        }[];
      };
      respond_to_clan_invite: {
        Args: { p_accept: boolean; p_membership_id: string };
        Returns: {
          membership_id: string;
          status: Database["public"]["Enums"]["clan_member_status"];
        }[];
      };
      restore_codex_version: {
        Args: { p_article_id: string; p_reason: string; p_version: number };
        Returns: {
          article_id: string;
          version: number;
        }[];
      };
      review_clan_request: {
        Args: { p_accept: boolean; p_membership_id: string; p_reason?: string };
        Returns: {
          membership_id: string;
          status: Database["public"]["Enums"]["clan_member_status"];
        }[];
      };
      review_codex_suggestion: {
        Args: {
          p_expected_status: Database["public"]["Enums"]["codex_suggestion_status"];
          p_review_note: string;
          p_status: Database["public"]["Enums"]["codex_suggestion_status"];
          p_suggestion_id: string;
        };
        Returns: {
          suggestion_id: string;
        }[];
      };
      revoke_badge: {
        Args: { p_reason: string; p_user_badge_id: string };
        Returns: {
          user_badge_id: string;
        }[];
      };
      search_content: {
        Args: {
          p_author_id?: string;
          p_entity_type?: string;
          p_limit?: number;
          p_offset?: number;
          p_plaza_id?: string;
          p_query: string;
          p_tag_slug?: string;
        };
        Returns: {
          author_display_name: string;
          author_id: string;
          created_at: string;
          entity_id: string;
          entity_type: string;
          excerpt: string;
          plaza_id: string;
          plaza_slug: string;
          title: string;
        }[];
      };
      send_chat_message: {
        Args: { p_body: string; p_channel_id: string; p_parent_id?: string };
        Returns: {
          message_id: string;
        }[];
      };
      send_friend_request: {
        Args: { p_addressee_id: string; p_note?: string };
        Returns: {
          friendship_id: string;
        }[];
      };
      set_clan_emblem: {
        Args: { p_clan_id: string; p_expected_path: string; p_new_path: string };
        Returns: boolean;
      };
      set_clan_member_role: {
        Args: {
          p_clan_id: string;
          p_member_id: string;
          p_reason: string;
          p_role: Database["public"]["Enums"]["clan_member_role"];
        };
        Returns: {
          membership_id: string;
        }[];
      };
      set_codex_article_status: {
        Args: {
          p_article_id: string;
          p_expected_status: Database["public"]["Enums"]["codex_article_status"];
          p_reason?: string;
          p_status: Database["public"]["Enums"]["codex_article_status"];
        };
        Returns: {
          article_id: string;
        }[];
      };
      set_codex_proposal_contributor_status: {
        Args: {
          p_expected_status: Database["public"]["Enums"]["codex_contribution_status"];
          p_member_id: string;
          p_proposal_id: string;
          p_reason?: string;
          p_status: Database["public"]["Enums"]["codex_contribution_status"];
        };
        Returns: {
          contributor_id: string;
        }[];
      };
      set_comment_vote: {
        Args: { p_comment_id: string; p_value: number };
        Returns: {
          caller_vote: number;
          dislikes_count: number;
          likes_count: number;
        }[];
      };
      set_notification_preferences: {
        Args: { p_types: Json };
        Returns: {
          types: Json;
        }[];
      };
      set_own_post_tags: {
        Args: { p_post_id: string; p_tag_slugs: string[] };
        Returns: {
          tag_label: string;
          tag_slug: string;
        }[];
      };
      set_post_vote: {
        Args: { p_post_id: string; p_value: number };
        Returns: {
          caller_vote: number;
          dislikes_count: number;
          likes_count: number;
        }[];
      };
      set_profile_avatar: {
        Args: { p_expected_path: string; p_new_path: string };
        Returns: boolean;
      };
      toggle_bookmark: {
        Args: { p_post_id: string };
        Returns: {
          bookmarked: boolean;
        }[];
      };
      toggle_chat_reaction: {
        Args: { p_message_id: string; p_reaction_key: string };
        Returns: {
          caller_reacted: boolean;
          reaction_key: string;
          total: number;
        }[];
      };
      toggle_codex_bookmark: {
        Args: { p_article_id: string };
        Returns: {
          bookmarked: boolean;
        }[];
      };
      toggle_comment_reaction: {
        Args: { p_comment_id: string; p_reaction_key: string };
        Returns: {
          caller_reacted: boolean;
          reaction_key: string;
          total: number;
        }[];
      };
      toggle_post_reaction: {
        Args: { p_post_id: string; p_reaction_key: string };
        Returns: {
          caller_reacted: boolean;
          reaction_key: string;
          total: number;
        }[];
      };
      transfer_clan_leadership: {
        Args: {
          p_clan_id: string;
          p_new_leader_member_id: string;
          p_reason: string;
        };
        Returns: {
          clan_id: string;
        }[];
      };
      unblock_user: {
        Args: { p_blocked_id: string };
        Returns: {
          unblocked: boolean;
        }[];
      };
      update_codex_article: {
        Args: {
          p_article_id: string;
          p_body: string;
          p_change_summary?: string;
          p_excerpt?: string;
          p_title: string;
        };
        Returns: {
          article_id: string;
        }[];
      };
      update_codex_proposal_status: {
        Args: {
          p_article_id?: string;
          p_expected_status: Database["public"]["Enums"]["codex_proposal_status"];
          p_proposal_id: string;
          p_reason?: string;
          p_status: Database["public"]["Enums"]["codex_proposal_status"];
        };
        Returns: {
          proposal_id: string;
        }[];
      };
      update_own_chat_message: {
        Args: { p_body: string; p_message_id: string };
        Returns: {
          message_id: string;
        }[];
      };
      update_own_comment: {
        Args: { p_body: string; p_comment_id: string };
        Returns: {
          comment_id: string;
        }[];
      };
      update_own_post: {
        Args: { p_body: string; p_post_id: string; p_title: string };
        Returns: {
          post_id: string;
        }[];
      };
      upsert_clan_internal_role: {
        Args: {
          p_clan_id: string;
          p_description?: string;
          p_name: string;
          p_permissions?: string[];
        };
        Returns: {
          internal_role_id: string;
        }[];
      };
      upsert_codex_proposal_contributor: {
        Args: {
          p_attribution?: Database["public"]["Enums"]["codex_attribution"];
          p_contribution_type: Database["public"]["Enums"]["codex_contribution_type"];
          p_evidence_ref?: string;
          p_member_id: string;
          p_proposal_id: string;
        };
        Returns: {
          contributor_id: string;
        }[];
      };
    };
    Enums: {
      appeal_status: "open" | "under_review" | "granted" | "denied";
      badge_status: "active" | "retired";
      chat_channel_kind: "public" | "announcements" | "clan" | "private";
      chat_channel_status: "active" | "archived";
      chat_message_status: "visible" | "hidden" | "deleted";
      clan_member_role: "leader" | "officer" | "member";
      clan_member_status: "pending" | "active" | "invited" | "rejected" | "left" | "expelled";
      clan_privacy: "open" | "invite" | "closed";
      clan_status: "active" | "archived";
      codex_article_status: "draft" | "published" | "unpublished" | "archived" | "locked";
      codex_attribution: "public" | "anonymous" | "withdrawn";
      codex_contribution_status: "proposed" | "confirmed" | "rejected" | "withdrawn";
      codex_contribution_type:
        "question" | "explanation" | "evidence" | "synthesis" | "review" | "edit";
      codex_proposal_status:
        | "proposed"
        | "classified"
        | "drafting"
        | "reviewed"
        | "published"
        | "rejected"
        | "withdrawn"
        | "reopened"
        | "replaced";
      codex_source_type: "post" | "comment" | "chat_message" | "external";
      codex_suggestion_status: "open" | "accepted" | "rejected" | "merged";
      comment_status:
        "published" | "hidden" | "quarantined" | "deleted_by_author" | "deleted_by_moderator";
      evidence_visibility: "public" | "private";
      friendship_status: "pending" | "accepted" | "rejected" | "cancelled" | "removed";
      notification_type:
        | "post_reply"
        | "comment_reply"
        | "reaction"
        | "mention"
        | "friend_request"
        | "clan_invite"
        | "warning"
        | "announcement"
        | "report_resolved";
      outbox_status: "pending" | "delivered" | "failed";
      plaza_status: "active" | "archived";
      plaza_visibility: "public" | "members" | "private";
      post_status:
        | "draft"
        | "pending_review"
        | "published"
        | "closed"
        | "hidden"
        | "quarantined"
        | "deleted_by_author"
        | "deleted_by_moderator"
        | "archived";
      rank_status: "active" | "retired";
      report_reason:
        | "spam"
        | "harassment"
        | "hate_speech"
        | "violence"
        | "sexual_content"
        | "misinformation"
        | "impersonation"
        | "off_topic"
        | "other";
      report_status: "open" | "under_review" | "resolved" | "dismissed";
      user_badge_status: "awarded" | "revoked";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      appeal_status: ["open", "under_review", "granted", "denied"],
      badge_status: ["active", "retired"],
      chat_channel_kind: ["public", "announcements", "clan", "private"],
      chat_channel_status: ["active", "archived"],
      chat_message_status: ["visible", "hidden", "deleted"],
      clan_member_role: ["leader", "officer", "member"],
      clan_member_status: ["pending", "active", "invited", "rejected", "left", "expelled"],
      clan_privacy: ["open", "invite", "closed"],
      clan_status: ["active", "archived"],
      codex_article_status: ["draft", "published", "unpublished", "archived", "locked"],
      codex_attribution: ["public", "anonymous", "withdrawn"],
      codex_contribution_status: ["proposed", "confirmed", "rejected", "withdrawn"],
      codex_contribution_type: [
        "question",
        "explanation",
        "evidence",
        "synthesis",
        "review",
        "edit",
      ],
      codex_proposal_status: [
        "proposed",
        "classified",
        "drafting",
        "reviewed",
        "published",
        "rejected",
        "withdrawn",
        "reopened",
        "replaced",
      ],
      codex_source_type: ["post", "comment", "chat_message", "external"],
      codex_suggestion_status: ["open", "accepted", "rejected", "merged"],
      comment_status: [
        "published",
        "hidden",
        "quarantined",
        "deleted_by_author",
        "deleted_by_moderator",
      ],
      evidence_visibility: ["public", "private"],
      friendship_status: ["pending", "accepted", "rejected", "cancelled", "removed"],
      notification_type: [
        "post_reply",
        "comment_reply",
        "reaction",
        "mention",
        "friend_request",
        "clan_invite",
        "warning",
        "announcement",
        "report_resolved",
      ],
      outbox_status: ["pending", "delivered", "failed"],
      plaza_status: ["active", "archived"],
      plaza_visibility: ["public", "members", "private"],
      post_status: [
        "draft",
        "pending_review",
        "published",
        "closed",
        "hidden",
        "quarantined",
        "deleted_by_author",
        "deleted_by_moderator",
        "archived",
      ],
      rank_status: ["active", "retired"],
      report_reason: [
        "spam",
        "harassment",
        "hate_speech",
        "violence",
        "sexual_content",
        "misinformation",
        "impersonation",
        "off_topic",
        "other",
      ],
      report_status: ["open", "under_review", "resolved", "dismissed"],
      user_badge_status: ["awarded", "revoked"],
    },
  },
} as const;
