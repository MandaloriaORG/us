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
      admin_create_plaza: {
        Args: {
          p_description?: string;
          p_name: string;
          p_slug: string;
          p_sort_order?: number;
          p_visibility?: Database["public"]["Enums"]["plaza_visibility"];
        };
        Returns: {
          plaza_id: string;
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
      admin_update_plaza: {
        Args: {
          p_description: string;
          p_name: string;
          p_plaza_id: string;
          p_rules: string;
          p_slug: string;
          p_sort_order: number;
          p_visibility: Database["public"]["Enums"]["plaza_visibility"];
        };
        Returns: {
          plaza_id: string;
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
      council_set_user_status: {
        Args: {
          p_expected_status: string;
          p_reason: string;
          p_status: string;
          p_user_id: string;
        };
        Returns: string;
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
      list_reaction_types: {
        Args: never;
        Returns: {
          emoji: string;
          key: string;
          label: string;
          sort_order: number;
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
      moderation_warn_user: {
        Args: { p_reason: string; p_user_id: string };
        Returns: {
          warning_id: string;
        }[];
      };
      reset_profile_avatar: {
        Args: { p_expected_path: string };
        Returns: boolean;
      };
      set_comment_vote: {
        Args: { p_comment_id: string; p_value: number };
        Returns: {
          caller_vote: number;
          dislikes_count: number;
          likes_count: number;
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
    };
    Enums: {
      comment_status:
        "published" | "hidden" | "quarantined" | "deleted_by_author" | "deleted_by_moderator";
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
      comment_status: [
        "published",
        "hidden",
        "quarantined",
        "deleted_by_author",
        "deleted_by_moderator",
      ],
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
    },
  },
} as const;
