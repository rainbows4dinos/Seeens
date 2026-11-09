
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "affiliations": {
                  Row: {
                    "created_at": string,"from_connection_id": string,"id": string,"is_current": boolean,"kind": Database["public"]['Enums']["affiliation_kind"],"notes": string | null,"role": string | null,"to_connection_id": string,"updated_at": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"from_connection_id": string,"id"?: string,"is_current"?: boolean,"kind"?: Database["public"]['Enums']["affiliation_kind"],"notes"?: string | null,"role"?: string | null,"to_connection_id": string,"updated_at"?: string,"workspace_id": string
                  }
                  Update: {
                    "created_at"?: string,"from_connection_id"?: string,"id"?: string,"is_current"?: boolean,"kind"?: Database["public"]['Enums']["affiliation_kind"],"notes"?: string | null,"role"?: string | null,"to_connection_id"?: string,"updated_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "affiliations_workspace_id_from_connection_id_fkey"
      columns: ["workspace_id","from_connection_id"]
isOneToOne: false
      referencedRelation: "connections"
      referencedColumns: ["workspace_id","id"]
    },{
      foreignKeyName: "affiliations_workspace_id_to_connection_id_fkey"
      columns: ["workspace_id","to_connection_id"]
isOneToOne: false
      referencedRelation: "connections"
      referencedColumns: ["workspace_id","id"]
    }
                  ]
                },"connection_links": {
                  Row: {
                    "connection_id": string,"created_at": string,"id": string,"label": string | null,"position": number,"url": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "connection_id": string,"created_at"?: string,"id"?: string,"label"?: string | null,"position"?: number,"url": string,"workspace_id": string
                  }
                  Update: {
                    "connection_id"?: string,"created_at"?: string,"id"?: string,"label"?: string | null,"position"?: number,"url"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "connection_links_workspace_id_connection_id_fkey"
      columns: ["workspace_id","connection_id"]
isOneToOne: false
      referencedRelation: "connections"
      referencedColumns: ["workspace_id","id"]
    }
                  ]
                },"connection_scenes": {
                  Row: {
                    "connection_id": string,"created_at": string,"scene_id": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "connection_id": string,"created_at"?: string,"scene_id": string,"workspace_id": string
                  }
                  Update: {
                    "connection_id"?: string,"created_at"?: string,"scene_id"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "connection_scenes_workspace_id_connection_id_fkey"
      columns: ["workspace_id","connection_id"]
isOneToOne: false
      referencedRelation: "connections"
      referencedColumns: ["workspace_id","id"]
    },{
      foreignKeyName: "connection_scenes_workspace_id_scene_id_fkey"
      columns: ["workspace_id","scene_id"]
isOneToOne: false
      referencedRelation: "scenes"
      referencedColumns: ["workspace_id","id"]
    }
                  ]
                },"connection_status_changes": {
                  Row: {
                    "changed_at": string,"changed_by": string | null,"connection_id": string,"from_status": Database["public"]['Enums']["connection_status"] | null,"id": number,"to_status": Database["public"]['Enums']["connection_status"],"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "changed_at"?: string,"changed_by"?: string | null,"connection_id": string,"from_status"?: Database["public"]['Enums']["connection_status"] | null,"id"?: never,"to_status": Database["public"]['Enums']["connection_status"],"workspace_id": string
                  }
                  Update: {
                    "changed_at"?: string,"changed_by"?: string | null,"connection_id"?: string,"from_status"?: Database["public"]['Enums']["connection_status"] | null,"id"?: never,"to_status"?: Database["public"]['Enums']["connection_status"],"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "connection_status_changes_connection_id_fkey"
      columns: ["connection_id"]
isOneToOne: false
      referencedRelation: "connections"
      referencedColumns: ["id"]
    }
                  ]
                },"connection_merges": {
                  Row: {
                    "id": string,"keep_id": string,"log": Json,"merged_at": string,"merged_by": string | null,"merged_ids": (string)[],"merged_summary": Json,"purged_at": string | null,"undone_at": string | null,"undone_by": string | null,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"keep_id": string,"log"?: Json,"merged_at"?: string,"merged_by"?: string | null,"merged_ids": (string)[],"merged_summary"?: Json,"purged_at"?: string | null,"undone_at"?: string | null,"undone_by"?: string | null,"workspace_id": string
                  }
                  Update: {
                    "id"?: string,"keep_id"?: string,"log"?: Json,"merged_at"?: string,"merged_by"?: string | null,"merged_ids"?: (string)[],"merged_summary"?: Json,"purged_at"?: string | null,"undone_at"?: string | null,"undone_by"?: string | null,"workspace_id"?: string
                  }
                  Relationships: []
                },"connection_not_duplicates": {
                  Row: {
                    "connection_a": string,"connection_b": string,"created_at": string,"created_by": string | null,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "connection_a": string,"connection_b": string,"created_at"?: string,"created_by"?: string | null,"workspace_id": string
                  }
                  Update: {
                    "connection_a"?: string,"connection_b"?: string,"created_at"?: string,"created_by"?: string | null,"workspace_id"?: string
                  }
                  Relationships: []
                },"invites": {
                  Row: {
                    "accepted_at": string | null,"accepted_by": string | null,"created_at": string,"email": string | null,"expires_at": string,"id": string,"invited_by": string | null,"invited_by_name": string,"name": string | null,"revoked_at": string | null,"revoked_by": string | null,"role": Database["public"]["Enums"]["member_role"],"sent_at": string | null,"token_hash": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_at"?: string | null,"accepted_by"?: string | null,"created_at"?: string,"email"?: string | null,"expires_at"?: string,"id"?: string,"invited_by"?: string | null,"invited_by_name": string,"name"?: string | null,"revoked_at"?: string | null,"revoked_by"?: string | null,"role"?: Database["public"]["Enums"]["member_role"],"sent_at"?: string | null,"token_hash": string,"workspace_id": string
                  }
                  Update: {
                    "accepted_at"?: string | null,"accepted_by"?: string | null,"created_at"?: string,"email"?: string | null,"expires_at"?: string,"id"?: string,"invited_by"?: string | null,"invited_by_name"?: string,"name"?: string | null,"revoked_at"?: string | null,"revoked_by"?: string | null,"role"?: Database["public"]["Enums"]["member_role"],"sent_at"?: string | null,"token_hash"?: string,"workspace_id"?: string
                  }
                  Relationships: []
                },"feedback": {
                  Row: {
                    "app_version": string | null,"band_name": string | null,"body": string,"created_at": string,"error_digest": string | null,"github_url": string | null,"id": string,"kind": Database["public"]["Enums"]["feedback_kind"],"notified_at": string | null,"path": string | null,"screen": string | null,"screenshot_path": string | null,"sender_name": string,"status": Database["public"]["Enums"]["feedback_status"],"updated_at": string,"user_agent": string | null,"user_id": string | null,"workspace_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "app_version"?: string | null,"band_name"?: string | null,"body": string,"created_at"?: string,"error_digest"?: string | null,"github_url"?: string | null,"id"?: string,"kind": Database["public"]["Enums"]["feedback_kind"],"notified_at"?: string | null,"path"?: string | null,"screen"?: string | null,"screenshot_path"?: string | null,"sender_name": string,"status"?: Database["public"]["Enums"]["feedback_status"],"updated_at"?: string,"user_agent"?: string | null,"user_id"?: string | null,"workspace_id"?: string | null
                  }
                  Update: {
                    "app_version"?: string | null,"band_name"?: string | null,"body"?: string,"created_at"?: string,"error_digest"?: string | null,"github_url"?: string | null,"id"?: string,"kind"?: Database["public"]["Enums"]["feedback_kind"],"notified_at"?: string | null,"path"?: string | null,"screen"?: string | null,"screenshot_path"?: string | null,"sender_name"?: string,"status"?: Database["public"]["Enums"]["feedback_status"],"updated_at"?: string,"user_agent"?: string | null,"user_id"?: string | null,"workspace_id"?: string | null
                  }
                  Relationships: []
                },"connection_band_details": {
                  Row: { "archived_at": string | null,"connection_id": string,"email": string | null,"notes": string | null,"phone": string | null,"played_together": boolean,"status": Database["public"]["Enums"]["connection_status"] | null,"updated_at": string,"workspace_id": string }
                  ComputedFields: never
                  Insert: { "archived_at"?: string | null,"connection_id": string,"email"?: string | null,"notes"?: string | null,"phone"?: string | null,"played_together"?: boolean,"status"?: Database["public"]["Enums"]["connection_status"] | null,"updated_at"?: string,"workspace_id": string }
                  Update: { "archived_at"?: string | null,"connection_id"?: string,"email"?: string | null,"notes"?: string | null,"phone"?: string | null,"played_together"?: boolean,"status"?: Database["public"]["Enums"]["connection_status"] | null,"updated_at"?: string,"workspace_id"?: string }
                  Relationships: [
                    {
      foreignKeyName: "connection_band_details_connection_id_fkey"
      columns: ["connection_id"]
isOneToOne: false
      referencedRelation: "connections"
      referencedColumns: ["id"]
    }
                  ]
                },"app_admins": {
                  Row: { "created_at": string,"user_id": string }
                  ComputedFields: never
                  Insert: { "created_at"?: string,"user_id": string }
                  Update: { "created_at"?: string,"user_id"?: string }
                  Relationships: []
                },"connection_edits": {
                  Row: { "by_band": string | null,"changes": Json,"connection_id": string,"edited_at": string,"edited_by": string | null,"id": number }
                  ComputedFields: never
                  Insert: { "changes": Json,"connection_id": string,"edited_at"?: string,"by_band"?: string | null,"edited_by"?: string | null,"id"?: never }
                  Update: { "changes"?: Json,"connection_id"?: string,"edited_at"?: string,"by_band"?: string | null,"edited_by"?: string | null,"id"?: never }
                  Relationships: []
                },"connections": {
                  Row: {
                    "attributes": Json,"can_help_with": (string)[],"catalog_no": number,"created_at": string,"created_by": string | null,"group_type": Database["public"]['Enums']["group_type"] | null,"id": string,"is_us": boolean,"keep_private": boolean,"kind": Database["public"]['Enums']["connection_kind"],"locality_id": string | null,"merged_at": string | null,"merged_into": string | null,"name": string,"person_roles": (Database["public"]['Enums']["person_role"])[],"photo_alt": string | null,"photo_original_path": string | null,"photo_path": string | null,"photo_settings": Json | null,"updated_at": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attributes"?: Json,"can_help_with"?: (string)[],"catalog_no"?: number,"created_at"?: string,"created_by"?: string | null,"group_type"?: Database["public"]['Enums']["group_type"] | null,"id"?: string,"is_us"?: boolean,"keep_private"?: boolean,"kind"?: Database["public"]['Enums']["connection_kind"],"locality_id"?: string | null,"merged_at"?: string | null,"merged_into"?: string | null,"name": string,"person_roles"?: (Database["public"]['Enums']["person_role"])[],"photo_alt"?: string | null,"photo_original_path"?: string | null,"photo_path"?: string | null,"photo_settings"?: Json | null,"updated_at"?: string,"workspace_id": string
                  }
                  Update: {
                    "attributes"?: Json,"can_help_with"?: (string)[],"catalog_no"?: number,"created_at"?: string,"created_by"?: string | null,"group_type"?: Database["public"]['Enums']["group_type"] | null,"id"?: string,"is_us"?: boolean,"keep_private"?: boolean,"kind"?: Database["public"]['Enums']["connection_kind"],"locality_id"?: string | null,"merged_at"?: string | null,"merged_into"?: string | null,"name"?: string,"person_roles"?: (Database["public"]['Enums']["person_role"])[],"photo_alt"?: string | null,"photo_original_path"?: string | null,"photo_path"?: string | null,"photo_settings"?: Json | null,"updated_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "connections_workspace_id_created_by_fkey"
      columns: ["workspace_id","created_by"]
isOneToOne: false
      referencedRelation: "workspace_members"
      referencedColumns: ["workspace_id","user_id"]
    },{
      foreignKeyName: "connections_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "connections_workspace_id_locality_id_fkey"
      columns: ["workspace_id","locality_id"]
isOneToOne: false
      referencedRelation: "localities"
      referencedColumns: ["workspace_id","id"]
    }
                  ]
                },"localities": {
                  Row: {
                    "country": string | null,"country_code": string | null,"created_at": string,"id": string,"latitude": number | null,"longitude": number | null,"name": string,"place_id": number | null,"region": string | null,"region_code": string | null,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "country"?: string | null,"country_code"?: string | null,"created_at"?: string,"id"?: string,"latitude"?: number | null,"longitude"?: number | null,"name": string,"place_id"?: number | null,"region"?: string | null,"region_code"?: string | null,"workspace_id": string
                  }
                  Update: {
                    "country"?: string | null,"country_code"?: string | null,"created_at"?: string,"id"?: string,"latitude"?: number | null,"longitude"?: number | null,"name"?: string,"place_id"?: number | null,"region"?: string | null,"region_code"?: string | null,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "localities_place_id_fkey"
      columns: ["place_id"]
isOneToOne: false
      referencedRelation: "places"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "localities_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"next_actions": {
                  Row: {
                    "assignee_id": string | null,"closed_at": string | null,"closed_by": string | null,"connection_id": string,"created_at": string,"created_by": string | null,"description": string,"due_on": string | null,"id": string,"status": Database["public"]['Enums']["action_status"],"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "assignee_id"?: string | null,"closed_at"?: string | null,"closed_by"?: string | null,"connection_id": string,"created_at"?: string,"created_by"?: string | null,"description": string,"due_on"?: string | null,"id"?: string,"status"?: Database["public"]['Enums']["action_status"],"workspace_id": string
                  }
                  Update: {
                    "assignee_id"?: string | null,"closed_at"?: string | null,"closed_by"?: string | null,"connection_id"?: string,"created_at"?: string,"created_by"?: string | null,"description"?: string,"due_on"?: string | null,"id"?: string,"status"?: Database["public"]['Enums']["action_status"],"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "next_actions_workspace_id_assignee_id_fkey"
      columns: ["workspace_id","assignee_id"]
isOneToOne: false
      referencedRelation: "workspace_members"
      referencedColumns: ["workspace_id","user_id"]
    },{
      foreignKeyName: "next_actions_connection_id_fkey"
      columns: ["connection_id"]
isOneToOne: false
      referencedRelation: "connections"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "next_actions_workspace_id_created_by_fkey"
      columns: ["workspace_id","created_by"]
isOneToOne: false
      referencedRelation: "workspace_members"
      referencedColumns: ["workspace_id","user_id"]
    }
                  ]
                },"outreach_entries": {
                  Row: {
                    "author_id": string | null,"channel": Database["public"]['Enums']["outreach_channel"],"connection_id": string,"created_at": string,"id": string,"occurred_on": string,"summary": string,"updated_at": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id"?: string | null,"channel"?: Database["public"]['Enums']["outreach_channel"],"connection_id": string,"created_at"?: string,"id"?: string,"occurred_on"?: string,"summary": string,"updated_at"?: string,"workspace_id": string
                  }
                  Update: {
                    "author_id"?: string | null,"channel"?: Database["public"]['Enums']["outreach_channel"],"connection_id"?: string,"created_at"?: string,"id"?: string,"occurred_on"?: string,"summary"?: string,"updated_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "outreach_entries_workspace_id_author_id_fkey"
      columns: ["workspace_id","author_id"]
isOneToOne: false
      referencedRelation: "workspace_members"
      referencedColumns: ["workspace_id","user_id"]
    },{
      foreignKeyName: "outreach_entries_connection_id_fkey"
      columns: ["connection_id"]
isOneToOne: false
      referencedRelation: "connections"
      referencedColumns: ["id"]
    }
                  ]
                },"place_aliases": {
                  Row: {
                    "alias": string,"created_at": string,"created_by": string | null,"place_id": number
                  }
                  ComputedFields: never
                  Insert: {
                    "alias": string,"created_at"?: string,"created_by"?: string | null,"place_id": number
                  }
                  Update: {
                    "alias"?: string,"created_at"?: string,"created_by"?: string | null,"place_id"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "place_aliases_place_id_fkey"
      columns: ["place_id"]
isOneToOne: false
      referencedRelation: "places"
      referencedColumns: ["id"]
    }
                  ]
                },"places": {
                  Row: {
                    "ascii_name": string,"country_code": string,"country_name": string,"id": number,"latitude": number,"longitude": number,"name": string,"population": number,"region_code": string | null,"region_name": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "ascii_name": string,"country_code": string,"country_name": string,"id": number,"latitude": number,"longitude": number,"name": string,"population"?: number,"region_code"?: string | null,"region_name"?: string | null
                  }
                  Update: {
                    "ascii_name"?: string,"country_code"?: string,"country_name"?: string,"id"?: number,"latitude"?: number,"longitude"?: number,"name"?: string,"population"?: number,"region_code"?: string | null,"region_name"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"scenes": {
                  Row: {
                    "created_at": string,"description": string | null,"id": string,"locality_id": string | null,"name": string,"parent_id": string | null,"town_suggestion_dismissed_at": string | null,"updated_at": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"description"?: string | null,"id"?: string,"locality_id"?: string | null,"name": string,"parent_id"?: string | null,"updated_at"?: string,"workspace_id": string
                  }
                  Update: {
                    "created_at"?: string,"description"?: string | null,"id"?: string,"locality_id"?: string | null,"name"?: string,"parent_id"?: string | null,"updated_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "scenes_parent_same_workspace"
      columns: ["workspace_id","parent_id"]
isOneToOne: false
      referencedRelation: "scenes"
      referencedColumns: ["workspace_id","id"]
    },{
      foreignKeyName: "scenes_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "scenes_workspace_id_locality_id_fkey"
      columns: ["workspace_id","locality_id"]
isOneToOne: false
      referencedRelation: "localities"
      referencedColumns: ["workspace_id","id"]
    }
                  ]
                },"workspace_members": {
                  Row: {
                    "connection_id": string | null,"created_at": string,"display_name": string,"getting_started_dismissed_at": string | null,"role": Database["public"]['Enums']["member_role"],"user_id": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "connection_id"?: string | null,"created_at"?: string,"display_name": string,"role"?: Database["public"]['Enums']["member_role"],"user_id": string,"workspace_id": string
                  }
                  Update: {
                    "connection_id"?: string | null,"created_at"?: string,"display_name"?: string,"role"?: Database["public"]['Enums']["member_role"],"user_id"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "workspace_members_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"workspaces": {
                  Row: {
                    "created_at": string,"id": string,"listing_id": string | null,"name": string,"time_zone": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"listing_id"?: string | null,"name": string,"time_zone"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"name"?: string,"time_zone"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "create_invite":
{ Args: { "p_workspace_id": string,"p_email": string | null,"p_name": string | null,"p_role": Database["public"]["Enums"]["member_role"] }; Returns: { "invite_id": string,"token": string,"existing": boolean,"first_sent_by": string | null }[] },
            "renew_invite_link":
{ Args: { "p_invite_id": string }; Returns: string },
            "mark_invite_sent":
{ Args: { "p_invite_id": string }; Returns: undefined },
            "revoke_invite":
{ Args: { "p_invite_id": string }; Returns: undefined },
            "invite_preview":
{ Args: { "p_token": string }; Returns: { "band": string,"invited_by": string,"email": string | null,"name": string | null,"role": Database["public"]["Enums"]["member_role"],"status": string }[] },
            "accept_invite":
{ Args: { "p_token": string,"p_display_name": string | null }; Returns: string },
            "opt_out_of_invites":
{ Args: { "p_token": string }; Returns: undefined },
            "band_members":
{ Args: { "p_workspace_id": string }; Returns: { "user_id": string,"display_name": string,"role": Database["public"]["Enums"]["member_role"],"email": string,"joined_at": string }[] },
            "set_member_role":
{ Args: { "p_workspace_id": string,"p_user_id": string,"p_role": Database["public"]["Enums"]["member_role"] }; Returns: undefined },
            "remove_member":
{ Args: { "p_workspace_id": string,"p_user_id": string }; Returns: undefined },
            "rename_band":
{ Args: { "p_workspace_id": string,"p_name": string }; Returns: undefined },
            "update_my_display_name":
{ Args: { "p_name": string }; Returns: undefined },
            "leave_workspace":
{ Args: { "p_workspace_id": string }; Returns: undefined },
            "prepare_account_deletion":
{ Args: never; Returns: (string)[] },
            "is_app_admin":
{ Args: never; Returns: boolean },
            "is_moderator":
{ Args: never; Returns: boolean },
            "list_moderators":
{ Args: never; Returns: { "user_id": string,"email": string,"display_name": string | null,"granted_at": string,"admin": boolean }[] },
            "list_accounts":
{ Args: never; Returns: { "user_id": string,"email": string,"display_name": string | null,"bands": string | null,"moderator": boolean,"admin": boolean }[] },
            "findable_people":
{ Args: { "p_workspace_id": string }; Returns: { "connection_id": string,"name": string,"added_by": string,"in_band": boolean }[] },
            "add_place_alias":
{ Args: { "p_alias": string,"p_place_id": number }; Returns: undefined },
            "remove_place_alias":
{ Args: { "p_alias": string }; Returns: undefined },
            "preview_cards":
{ Args: { "p_limit"?: number }; Returns: { "id": string,"name": string,"group_type": Database["public"]["Enums"]["group_type"],"catalog_no": number,"town": string | null,"scenes": string[],"photo_path": string }[] },
            "preview_photo_path":
{ Args: { "p_id": string }; Returns: string | null },
            "scene_suggestions":
{ Args: { "p_workspace_id": string }; Returns: { "scene_id": string,"scene_name": string,"place_id": number | null,"town": string | null,"parent_id": string | null,"parent_name": string | null }[] },
            "apply_scene_suggestion":
{ Args: { "p_scene_id": string }; Returns: undefined },
            "dismiss_scene_suggestion":
{ Args: { "p_scene_id": string }; Returns: undefined },
            "getting_started":
{ Args: { "p_workspace_id": string }; Returns: Json },
            "dismiss_getting_started":
{ Args: { "p_workspace_id": string }; Returns: undefined },
            "invitable_bands":
{ Args: never; Returns: { "connection_id": string,"name": string,"town": string | null,"added_by": string }[] },
            "invite_band":
{ Args: { "p_listing_id": string | null,"p_band": string | null,"p_email": string | null,"p_name": string | null }; Returns: { "workspace_id": string,"invite_id": string,"token": string,"band": string }[] },
            "list_bands":
{ Args: never; Returns: { "workspace_id": string,"name": string,"created_at": string,"members": number,"listing_from": string | null,"invite_id": string | null,"invite_email": string | null,"invite_expires_at": string | null }[] },
            "listing_claim":
{ Args: { "p_connection_id": string }; Returns: { "band": string,"mine": boolean,"joined": boolean }[] },
            "renew_band_invite":
{ Args: { "p_invite_id": string }; Returns: string },
            "grant_moderator_user":
{ Args: { "p_user_id": string }; Returns: { "email": string,"display_name": string | null,"added": boolean }[] },
            "moderator_welcome_pending":
{ Args: never; Returns: boolean },
            "dismiss_moderator_welcome":
{ Args: never; Returns: undefined },
            "grant_moderator":
{ Args: { "p_email": string }; Returns: string },
            "revoke_moderator":
{ Args: { "p_user_id": string }; Returns: undefined },
            "set_keep_private":
{ Args: { "p_ids": (string)[],"p_keep": boolean }; Returns: Json },
            "moderate_connection":
{ Args: { "p_id": string,"p_name": string,"p_kind": Database["public"]['Enums']["connection_kind"],"p_person_roles": (Database["public"]['Enums']["person_role"])[],"p_group_type": Database["public"]['Enums']["group_type"] | null,"p_can_help_with": (string)[],"p_links": Json,"p_place_id"?: number,"p_keep_locality_id"?: string,"p_attributes"?: Json,"p_expected_updated_at"?: string }; Returns: undefined },
            "link_me_to_person":
{ Args: { "p_workspace_id": string,"p_connection_id": string }; Returns: undefined },
            "unlink_me":
{ Args: { "p_workspace_id": string }; Returns: undefined },
            "create_my_person":
{ Args: { "p_workspace_id": string }; Returns: string },
            "submit_feedback":
{ Args: { "p_workspace_id": string,"p_kind": Database["public"]["Enums"]["feedback_kind"],"p_body": string,"p_path"?: string | null,"p_app_version"?: string | null,"p_user_agent"?: string | null,"p_screen"?: string | null,"p_error_digest"?: string | null,"p_screenshot_path"?: string | null }; Returns: string },
            "update_feedback":
{ Args: { "p_id": string,"p_status": Database["public"]["Enums"]["feedback_status"],"p_github_url"?: string | null }; Returns: undefined },
            "mark_feedback_notified":
{ Args: { "p_id": string }; Returns: undefined },
            "merge_connections":
{ Args: { "p_keep": string,"p_merge": (string)[],"p_photo"?: Json }; Returns: string },
            "merged_photos_due":
{ Args: never; Returns: (string)[] },
            "purge_merged_connections":
{ Args: never; Returns: number },
            "undo_merge":
{ Args: { "p_merge": string }; Returns: string },
            "merged_target":
{ Args: { "p_id": string }; Returns: string | null },
            "add_band_members":
{ Args: { "p_locality_id"?: string,"p_played_together"?: boolean,"p_scene_ids"?: (string)[],"p_band_id": string,"p_rows": Json,"p_workspace_id": string }; Returns: Json },
            "import_connections":
{ Args: { "p_rows": Json,"p_workspace_id": string }; Returns: Json },
"directory_page":
{ Args: { "p_ages"?: string,"p_capacity"?: string,"p_instrument"?: string,"p_after"?: Json,"p_archived": boolean,"p_counts"?: boolean,"p_group_type"?: Database["public"]['Enums']["group_type"],"p_hide_avoid"?: boolean,"p_kind"?: Database["public"]['Enums']["connection_kind"],"p_limit"?: number,"p_list_status"?: Database["public"]['Enums']["connection_status"],"p_person_role"?: Database["public"]['Enums']["person_role"],"p_q"?: string,"p_scene_ids"?: (string)[],"p_statuses"?: (Database["public"]['Enums']["connection_status"])[],"p_town"?: string,"p_type"?: string,"p_workspace_id": string,"p_scope"?: string,"p_no_status"?: boolean }; Returns: Json },
            "create_linked_connection":
{ Args: { "p_locality_id"?: string,"p_played_together"?: boolean,"p_scene_ids"?: (string)[],"p_affiliation_kind": Database["public"]['Enums']["affiliation_kind"],"p_group_type"?: Database["public"]['Enums']["group_type"],"p_is_current": boolean,"p_kind": Database["public"]['Enums']["connection_kind"],"p_name": string,"p_new_is_from": boolean,"p_other_id": string,"p_person_roles": (Database["public"]['Enums']["person_role"])[],"p_role"?: string,"p_workspace_id": string }; Returns: string },
"save_connection":
{ Args: { "p_attributes"?: Json,"p_can_help_with": (string)[],"p_email"?: string,"p_expected_updated_at"?: string,"p_group_type"?: Database["public"]['Enums']["group_type"],"p_id"?: string,"p_is_us": boolean,"p_keep_locality_id"?: string,"p_kind": Database["public"]['Enums']["connection_kind"],"p_links": Json,"p_name": string,"p_new_scenes": (string)[],"p_notes"?: string,"p_person_roles": (Database["public"]['Enums']["person_role"])[],"p_phone"?: string,"p_place_id"?: number,"p_played_together": boolean,"p_scene_ids": (string)[],"p_status": Database["public"]['Enums']["connection_status"]|null,"p_workspace_id": string }; Returns: string },
"search_places":
{ Args: { "max_results"?: number,"prefer_countries"?: (string)[],"q": string,"workspace_id"?: string }; Returns: {
              "ascii_name": string,
"country_code": string,
"country_name": string,
"id": number,
"latitude": number,
"longitude": number,
"name": string,
"population": number,
"region_code": string | null,
"region_name": string | null
            }[]
                          SetofOptions: {
        from: "*"
        to: "places"
        isOneToOne: false
        isSetofReturn: true
      } },
"set_next_action":
{ Args: { "p_assignee_id"?: string,"p_connection_id": string,"p_description": string,"p_due_on"?: string,"p_workspace_id"?: string }; Returns: {
              "assignee_id": string | null,
"closed_at": string | null,
"closed_by": string | null,
"connection_id": string,
"created_at": string,
"created_by": string | null,
"description": string,
"due_on": string | null,
"id": string,
"status": Database["public"]['Enums']["action_status"],
"workspace_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "next_actions"
        isOneToOne: true
        isSetofReturn: false
      } }
          }
          Enums: {
            "action_status": "open"|"done"|"dropped"|"replaced","affiliation_kind": "member"|"works_with"|"books"|"on_label"|"related"|"other","connection_kind": "person"|"group","connection_status": "homies"|"lets_play"|"prospect"|"neutral"|"avoid","group_type": "band"|"venue"|"label"|"recording_studio"|"production_studio"|"radio_station"|"press"|"promoter_collective"|"other","feedback_kind": "bug"|"idea"|"confusing"|"other","feedback_status": "new"|"looking"|"planned"|"done"|"wont_do","member_role": "owner"|"member","outreach_channel": "in_person"|"email"|"text"|"call"|"instagram"|"other_social"|"other","person_role": "musician"|"dj"|"promoter"|"booker"|"manager"|"label_owner"|"producer"|"recording_engineer"|"live_sound_engineer"|"photographer"|"videographer"|"artist_designer"|"writer"|"radio_host"|"other"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "action_status": ["open", "done", "dropped", "replaced"],"affiliation_kind": ["member", "works_with", "books", "on_label", "related", "other"],"connection_kind": ["person", "group"],"connection_status": ["homies", "lets_play", "prospect", "neutral", "avoid"],"group_type": ["band", "venue", "label", "recording_studio", "production_studio", "radio_station", "press", "promoter_collective", "other"],"feedback_kind": ["bug", "idea", "confusing", "other"],"feedback_status": ["new", "looking", "planned", "done", "wont_do"],"member_role": ["owner", "member"],"outreach_channel": ["in_person", "email", "text", "call", "instagram", "other_social", "other"],"person_role": ["musician", "dj", "promoter", "booker", "manager", "label_owner", "producer", "recording_engineer", "live_sound_engineer", "photographer", "videographer", "artist_designer", "writer", "radio_host", "other"]
          }
        }
} as const
