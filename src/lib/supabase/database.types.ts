
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
      foreignKeyName: "connection_status_changes_workspace_id_connection_id_fkey"
      columns: ["workspace_id","connection_id"]
isOneToOne: false
      referencedRelation: "connections"
      referencedColumns: ["workspace_id","id"]
    }
                  ]
                },"connections": {
                  Row: {
                    "archived_at": string | null,"can_help_with": (string)[],"created_at": string,"created_by": string | null,"email": string | null,"group_type": Database["public"]['Enums']["group_type"] | null,"id": string,"is_us": boolean,"kind": Database["public"]['Enums']["connection_kind"],"locality_id": string | null,"name": string,"notes": string | null,"person_roles": (Database["public"]['Enums']["person_role"])[],"phone": string | null,"played_together": boolean,"status": Database["public"]['Enums']["connection_status"],"updated_at": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"can_help_with"?: (string)[],"created_at"?: string,"created_by"?: string | null,"email"?: string | null,"group_type"?: Database["public"]['Enums']["group_type"] | null,"id"?: string,"is_us"?: boolean,"kind"?: Database["public"]['Enums']["connection_kind"],"locality_id"?: string | null,"name": string,"notes"?: string | null,"person_roles"?: (Database["public"]['Enums']["person_role"])[],"phone"?: string | null,"played_together"?: boolean,"status"?: Database["public"]['Enums']["connection_status"],"updated_at"?: string,"workspace_id": string
                  }
                  Update: {
                    "archived_at"?: string | null,"can_help_with"?: (string)[],"created_at"?: string,"created_by"?: string | null,"email"?: string | null,"group_type"?: Database["public"]['Enums']["group_type"] | null,"id"?: string,"is_us"?: boolean,"kind"?: Database["public"]['Enums']["connection_kind"],"locality_id"?: string | null,"name"?: string,"notes"?: string | null,"person_roles"?: (Database["public"]['Enums']["person_role"])[],"phone"?: string | null,"played_together"?: boolean,"status"?: Database["public"]['Enums']["connection_status"],"updated_at"?: string,"workspace_id"?: string
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
      foreignKeyName: "next_actions_workspace_id_connection_id_fkey"
      columns: ["workspace_id","connection_id"]
isOneToOne: false
      referencedRelation: "connections"
      referencedColumns: ["workspace_id","id"]
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
      foreignKeyName: "outreach_entries_workspace_id_connection_id_fkey"
      columns: ["workspace_id","connection_id"]
isOneToOne: false
      referencedRelation: "connections"
      referencedColumns: ["workspace_id","id"]
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
                    "created_at": string,"description": string | null,"id": string,"locality_id": string | null,"name": string,"parent_id": string | null,"updated_at": string,"workspace_id": string
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
                    "created_at": string,"display_name": string,"role": Database["public"]['Enums']["member_role"],"user_id": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"display_name": string,"role"?: Database["public"]['Enums']["member_role"],"user_id": string,"workspace_id": string
                  }
                  Update: {
                    "created_at"?: string,"display_name"?: string,"role"?: Database["public"]['Enums']["member_role"],"user_id"?: string,"workspace_id"?: string
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
                    "created_at": string,"id": string,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"name": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"name"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "create_linked_connection":
{ Args: { "p_affiliation_kind": Database["public"]['Enums']["affiliation_kind"],"p_group_type"?: Database["public"]['Enums']["group_type"],"p_is_current": boolean,"p_kind": Database["public"]['Enums']["connection_kind"],"p_name": string,"p_new_is_from": boolean,"p_other_id": string,"p_person_roles": (Database["public"]['Enums']["person_role"])[],"p_role"?: string,"p_workspace_id": string }; Returns: string },
"save_connection":
{ Args: { "p_can_help_with": (string)[],"p_email"?: string,"p_expected_updated_at"?: string,"p_group_type"?: Database["public"]['Enums']["group_type"],"p_id"?: string,"p_is_us": boolean,"p_keep_locality_id"?: string,"p_kind": Database["public"]['Enums']["connection_kind"],"p_links": Json,"p_name": string,"p_new_scenes": (string)[],"p_notes"?: string,"p_person_roles": (Database["public"]['Enums']["person_role"])[],"p_phone"?: string,"p_place_id"?: number,"p_played_together": boolean,"p_scene_ids": (string)[],"p_status": Database["public"]['Enums']["connection_status"],"p_workspace_id": string }; Returns: string },
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
{ Args: { "p_assignee_id"?: string,"p_connection_id": string,"p_description": string,"p_due_on"?: string }; Returns: {
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
            "action_status": "open"|"done"|"dropped"|"replaced","affiliation_kind": "member"|"works_with"|"on_label"|"related"|"other","connection_kind": "person"|"group","connection_status": "homies"|"lets_play"|"prospect"|"neutral"|"avoid","group_type": "band"|"venue"|"label"|"recording_studio"|"production_studio"|"radio_station"|"press"|"promoter_collective"|"other","member_role": "owner"|"member","outreach_channel": "in_person"|"email"|"text"|"call"|"instagram"|"other_social"|"other","person_role": "musician"|"dj"|"promoter"|"booker"|"manager"|"label_owner"|"producer"|"recording_engineer"|"live_sound_engineer"|"photographer"|"videographer"|"artist_designer"|"writer"|"radio_host"|"other"
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
            "action_status": ["open", "done", "dropped", "replaced"],"affiliation_kind": ["member", "works_with", "on_label", "related", "other"],"connection_kind": ["person", "group"],"connection_status": ["homies", "lets_play", "prospect", "neutral", "avoid"],"group_type": ["band", "venue", "label", "recording_studio", "production_studio", "radio_station", "press", "promoter_collective", "other"],"member_role": ["owner", "member"],"outreach_channel": ["in_person", "email", "text", "call", "instagram", "other_social", "other"],"person_role": ["musician", "dj", "promoter", "booker", "manager", "label_owner", "producer", "recording_engineer", "live_sound_engineer", "photographer", "videographer", "artist_designer", "writer", "radio_host", "other"]
          }
        }
} as const
