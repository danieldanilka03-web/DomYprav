import { createPool } from './index.ts';

const DDL_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS "brigades" (
    "id" serial PRIMARY KEY NOT NULL,
    "name" text NOT NULL,
    "specialization" text NOT NULL,
    "leader_name" text NOT NULL,
    "phone" text NOT NULL,
    "status" text DEFAULT 'available' NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "buildings" (
    "id" serial PRIMARY KEY NOT NULL,
    "address" text NOT NULL,
    "district" text NOT NULL,
    "year_built" integer NOT NULL,
    "floors" integer NOT NULL,
    "entrances" integer NOT NULL,
    "total_area_sqm" numeric(10, 2) NOT NULL,
    "apartments_count" integer NOT NULL,
    "condition_score" integer DEFAULT 85 NOT NULL,
    "condition_status" text DEFAULT 'good' NOT NULL,
    "management_since" text NOT NULL,
    "image_key" text DEFAULT 'building_modern_tower' NOT NULL,
    "notes" text,
    "created_at" timestamp DEFAULT now() NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "apartments" (
    "id" serial PRIMARY KEY NOT NULL,
    "building_id" integer NOT NULL REFERENCES "buildings"("id") ON DELETE cascade,
    "number" text NOT NULL,
    "entrance" integer DEFAULT 1 NOT NULL,
    "floor" integer DEFAULT 1 NOT NULL,
    "area_sqm" numeric(8, 2) NOT NULL,
    "unit_type" text DEFAULT 'residential' NOT NULL,
    "owner_name" text NOT NULL,
    "owner_phone" text,
    "residents_count" integer DEFAULT 1 NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "warehouse_items" (
    "id" serial PRIMARY KEY NOT NULL,
    "sku" text NOT NULL UNIQUE,
    "name" text NOT NULL,
    "category" text NOT NULL,
    "unit" text DEFAULT 'шт' NOT NULL,
    "quantity" integer DEFAULT 0 NOT NULL,
    "min_quantity" integer DEFAULT 5 NOT NULL,
    "unit_price" numeric(10, 2) DEFAULT '0' NOT NULL,
    "location" text DEFAULT 'Основной склад' NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "users" (
    "id" serial PRIMARY KEY NOT NULL,
    "uid" text NOT NULL UNIQUE,
    "email" text NOT NULL UNIQUE,
    "password_hash" text,
    "full_name" text NOT NULL,
    "phone" text,
    "role" text DEFAULT 'resident' NOT NULL,
    "position" text,
    "brigade_id" integer REFERENCES "brigades"("id") ON DELETE set null,
    "building_id" integer REFERENCES "buildings"("id") ON DELETE set null,
    "apartment_number" text,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "engineering_systems" (
    "id" serial PRIMARY KEY NOT NULL,
    "building_id" integer NOT NULL REFERENCES "buildings"("id") ON DELETE cascade,
    "system_type" text NOT NULL,
    "name" text NOT NULL,
    "condition" text DEFAULT 'normal' NOT NULL,
    "wear_percent" integer DEFAULT 20 NOT NULL,
    "last_inspection_date" text NOT NULL,
    "next_inspection_date" text NOT NULL,
    "notes" text
  )`,
  `CREATE TABLE IF NOT EXISTS "maintenance_plans" (
    "id" serial PRIMARY KEY NOT NULL,
    "building_id" integer NOT NULL REFERENCES "buildings"("id") ON DELETE cascade,
    "system_id" integer REFERENCES "engineering_systems"("id") ON DELETE set null,
    "title" text NOT NULL,
    "description" text NOT NULL,
    "frequency" text DEFAULT 'quarterly' NOT NULL,
    "scheduled_date" text NOT NULL,
    "completed_date" text,
    "status" text DEFAULT 'planned' NOT NULL,
    "brigade_id" integer REFERENCES "brigades"("id") ON DELETE set null,
    "estimated_cost" numeric(10, 2) DEFAULT '0' NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "emergencies" (
    "id" serial PRIMARY KEY NOT NULL,
    "building_id" integer NOT NULL REFERENCES "buildings"("id") ON DELETE cascade,
    "system_type" text NOT NULL,
    "severity" text DEFAULT 'high' NOT NULL,
    "title" text NOT NULL,
    "description" text NOT NULL,
    "affected_apartments" text DEFAULT 'Весь подъезд' NOT NULL,
    "status" text DEFAULT 'active' NOT NULL,
    "brigade_id" integer REFERENCES "brigades"("id") ON DELETE set null,
    "reported_by_id" integer REFERENCES "users"("id") ON DELETE set null,
    "reported_at" timestamp DEFAULT now() NOT NULL,
    "localized_at" timestamp,
    "resolved_at" timestamp,
    "response_minutes" integer,
    "damage_cost" numeric(10, 2) DEFAULT '0' NOT NULL,
    "root_cause" text
  )`,
  `CREATE TABLE IF NOT EXISTS "tickets" (
    "id" serial PRIMARY KEY NOT NULL,
    "ticket_number" text NOT NULL UNIQUE,
    "building_id" integer NOT NULL REFERENCES "buildings"("id") ON DELETE cascade,
    "apartment_number" text,
    "category" text NOT NULL,
    "title" text NOT NULL,
    "description" text NOT NULL,
    "photo_data" text,
    "priority" text DEFAULT 'medium' NOT NULL,
    "status" text DEFAULT 'new' NOT NULL,
    "author_id" integer REFERENCES "users"("id") ON DELETE set null,
    "dispatcher_id" integer REFERENCES "users"("id") ON DELETE set null,
    "assignee_id" integer REFERENCES "users"("id") ON DELETE set null,
    "brigade_id" integer REFERENCES "brigades"("id") ON DELETE set null,
    "sla_deadline" timestamp,
    "started_at" timestamp,
    "completed_at" timestamp,
    "resolution_notes" text,
    "after_photo_data" text,
    "resident_rating" integer,
    "resident_feedback" text,
    "labor_cost" numeric(10, 2) DEFAULT '0' NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "ticket_history" (
    "id" serial PRIMARY KEY NOT NULL,
    "ticket_id" integer NOT NULL REFERENCES "tickets"("id") ON DELETE cascade,
    "actor_id" integer REFERENCES "users"("id") ON DELETE set null,
    "actor_name" text NOT NULL,
    "action" text NOT NULL,
    "from_status" text,
    "to_status" text,
    "comment" text,
    "created_at" timestamp DEFAULT now() NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "ticket_comments" (
    "id" serial PRIMARY KEY NOT NULL,
    "ticket_id" integer NOT NULL REFERENCES "tickets"("id") ON DELETE cascade,
    "author_id" integer REFERENCES "users"("id") ON DELETE set null,
    "author_name" text NOT NULL,
    "author_role" text NOT NULL,
    "message" text NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "ticket_materials" (
    "id" serial PRIMARY KEY NOT NULL,
    "ticket_id" integer NOT NULL REFERENCES "tickets"("id") ON DELETE cascade,
    "item_id" integer NOT NULL REFERENCES "warehouse_items"("id") ON DELETE restrict,
    "quantity_used" integer NOT NULL,
    "unit_price_at_use" numeric(10, 2) NOT NULL,
    "recorded_by_id" integer REFERENCES "users"("id") ON DELETE set null,
    "created_at" timestamp DEFAULT now() NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "meter_readings" (
    "id" serial PRIMARY KEY NOT NULL,
    "user_id" integer REFERENCES "users"("id") ON DELETE set null,
    "building_id" integer NOT NULL REFERENCES "buildings"("id") ON DELETE cascade,
    "apartment_number" text NOT NULL,
    "meter_type" text NOT NULL,
    "period" text NOT NULL,
    "value" numeric(10, 2) NOT NULL,
    "previous_value" numeric(10, 2),
    "consumption" numeric(10, 2),
    "submitted_at" timestamp DEFAULT now() NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "notifications" (
    "id" serial PRIMARY KEY NOT NULL,
    "user_id" integer REFERENCES "users"("id") ON DELETE cascade,
    "target_role" text,
    "building_id" integer REFERENCES "buildings"("id") ON DELETE cascade,
    "type" text DEFAULT 'system' NOT NULL,
    "title" text NOT NULL,
    "message" text NOT NULL,
    "is_read" boolean DEFAULT false NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL
  )`
];

export async function ensureTablesExist(): Promise<void> {
  const pool = createPool();
  for (const statement of DDL_STATEMENTS) {
    try {
      await pool.query(statement);
    } catch (e) {
      console.error('Error creating table statement:', e);
    }
  }
}
