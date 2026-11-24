CREATE TABLE "apartments" (
	"id" serial PRIMARY KEY NOT NULL,
	"building_id" integer NOT NULL,
	"number" text NOT NULL,
	"entrance" integer DEFAULT 1 NOT NULL,
	"floor" integer DEFAULT 1 NOT NULL,
	"area_sqm" numeric(8, 2) NOT NULL,
	"unit_type" text DEFAULT 'residential' NOT NULL,
	"owner_name" text NOT NULL,
	"owner_phone" text,
	"residents_count" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brigades" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"specialization" text NOT NULL,
	"leader_name" text NOT NULL,
	"phone" text NOT NULL,
	"status" text DEFAULT 'available' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "buildings" (
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
);
--> statement-breakpoint
CREATE TABLE "emergencies" (
	"id" serial PRIMARY KEY NOT NULL,
	"building_id" integer NOT NULL,
	"system_type" text NOT NULL,
	"severity" text DEFAULT 'high' NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"affected_apartments" text DEFAULT 'Весь подъезд' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"brigade_id" integer,
	"reported_by_id" integer,
	"reported_at" timestamp DEFAULT now() NOT NULL,
	"localized_at" timestamp,
	"resolved_at" timestamp,
	"response_minutes" integer,
	"damage_cost" numeric(10, 2) DEFAULT '0' NOT NULL,
	"root_cause" text
);
--> statement-breakpoint
CREATE TABLE "engineering_systems" (
	"id" serial PRIMARY KEY NOT NULL,
	"building_id" integer NOT NULL,
	"system_type" text NOT NULL,
	"name" text NOT NULL,
	"condition" text DEFAULT 'normal' NOT NULL,
	"wear_percent" integer DEFAULT 20 NOT NULL,
	"last_inspection_date" text NOT NULL,
	"next_inspection_date" text NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "maintenance_plans" (
	"id" serial PRIMARY KEY NOT NULL,
	"building_id" integer NOT NULL,
	"system_id" integer,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"frequency" text DEFAULT 'quarterly' NOT NULL,
	"scheduled_date" text NOT NULL,
	"completed_date" text,
	"status" text DEFAULT 'planned' NOT NULL,
	"brigade_id" integer,
	"estimated_cost" numeric(10, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meter_readings" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"building_id" integer NOT NULL,
	"apartment_number" text NOT NULL,
	"meter_type" text NOT NULL,
	"period" text NOT NULL,
	"value" numeric(10, 2) NOT NULL,
	"previous_value" numeric(10, 2),
	"consumption" numeric(10, 2),
	"submitted_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"target_role" text,
	"building_id" integer,
	"type" text DEFAULT 'system' NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticket_comments" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticket_id" integer NOT NULL,
	"author_id" integer,
	"author_name" text NOT NULL,
	"author_role" text NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticket_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticket_id" integer NOT NULL,
	"actor_id" integer,
	"actor_name" text NOT NULL,
	"action" text NOT NULL,
	"from_status" text,
	"to_status" text,
	"comment" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticket_materials" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticket_id" integer NOT NULL,
	"item_id" integer NOT NULL,
	"quantity_used" integer NOT NULL,
	"unit_price_at_use" numeric(10, 2) NOT NULL,
	"recorded_by_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tickets" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticket_number" text NOT NULL,
	"building_id" integer NOT NULL,
	"apartment_number" text,
	"category" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"photo_data" text,
	"priority" text DEFAULT 'medium' NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"author_id" integer,
	"dispatcher_id" integer,
	"assignee_id" integer,
	"brigade_id" integer,
	"sla_deadline" timestamp,
	"started_at" timestamp,
	"completed_at" timestamp,
	"resolution_notes" text,
	"after_photo_data" text,
	"resident_rating" integer,
	"resident_feedback" text,
	"labor_cost" numeric(10, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tickets_ticket_number_unique" UNIQUE("ticket_number")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"uid" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text,
	"full_name" text NOT NULL,
	"phone" text,
	"role" text DEFAULT 'resident' NOT NULL,
	"position" text,
	"brigade_id" integer,
	"building_id" integer,
	"apartment_number" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_uid_unique" UNIQUE("uid"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "warehouse_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"sku" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"unit" text DEFAULT 'шт' NOT NULL,
	"quantity" integer DEFAULT 0 NOT NULL,
	"min_quantity" integer DEFAULT 5 NOT NULL,
	"unit_price" numeric(10, 2) DEFAULT '0' NOT NULL,
	"location" text DEFAULT 'Основной склад' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "warehouse_items_sku_unique" UNIQUE("sku")
);
--> statement-breakpoint
ALTER TABLE "apartments" ADD CONSTRAINT "apartments_building_id_buildings_id_fk" FOREIGN KEY ("building_id") REFERENCES "public"."buildings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emergencies" ADD CONSTRAINT "emergencies_building_id_buildings_id_fk" FOREIGN KEY ("building_id") REFERENCES "public"."buildings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emergencies" ADD CONSTRAINT "emergencies_brigade_id_brigades_id_fk" FOREIGN KEY ("brigade_id") REFERENCES "public"."brigades"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emergencies" ADD CONSTRAINT "emergencies_reported_by_id_users_id_fk" FOREIGN KEY ("reported_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engineering_systems" ADD CONSTRAINT "engineering_systems_building_id_buildings_id_fk" FOREIGN KEY ("building_id") REFERENCES "public"."buildings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_plans" ADD CONSTRAINT "maintenance_plans_building_id_buildings_id_fk" FOREIGN KEY ("building_id") REFERENCES "public"."buildings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_plans" ADD CONSTRAINT "maintenance_plans_system_id_engineering_systems_id_fk" FOREIGN KEY ("system_id") REFERENCES "public"."engineering_systems"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_plans" ADD CONSTRAINT "maintenance_plans_brigade_id_brigades_id_fk" FOREIGN KEY ("brigade_id") REFERENCES "public"."brigades"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meter_readings" ADD CONSTRAINT "meter_readings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meter_readings" ADD CONSTRAINT "meter_readings_building_id_buildings_id_fk" FOREIGN KEY ("building_id") REFERENCES "public"."buildings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_building_id_buildings_id_fk" FOREIGN KEY ("building_id") REFERENCES "public"."buildings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_comments" ADD CONSTRAINT "ticket_comments_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_comments" ADD CONSTRAINT "ticket_comments_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_history" ADD CONSTRAINT "ticket_history_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_history" ADD CONSTRAINT "ticket_history_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_materials" ADD CONSTRAINT "ticket_materials_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_materials" ADD CONSTRAINT "ticket_materials_item_id_warehouse_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."warehouse_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_materials" ADD CONSTRAINT "ticket_materials_recorded_by_id_users_id_fk" FOREIGN KEY ("recorded_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_building_id_buildings_id_fk" FOREIGN KEY ("building_id") REFERENCES "public"."buildings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_dispatcher_id_users_id_fk" FOREIGN KEY ("dispatcher_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_assignee_id_users_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_brigade_id_brigades_id_fk" FOREIGN KEY ("brigade_id") REFERENCES "public"."brigades"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_brigade_id_brigades_id_fk" FOREIGN KEY ("brigade_id") REFERENCES "public"."brigades"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_building_id_buildings_id_fk" FOREIGN KEY ("building_id") REFERENCES "public"."buildings"("id") ON DELETE set null ON UPDATE no action;