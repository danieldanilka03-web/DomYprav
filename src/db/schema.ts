import { relations } from 'drizzle-orm';
import {
  boolean,
  integer,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

export const brigades = pgTable('brigades', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  specialization: text('specialization').notNull(), // plumbing | electricity | elevator | general | emergency
  leaderName: text('leader_name').notNull(),
  phone: text('phone').notNull(),
  status: text('status').notNull().default('available'), // available | on_call | busy
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const buildings = pgTable('buildings', {
  id: serial('id').primaryKey(),
  address: text('address').notNull(),
  district: text('district').notNull(),
  yearBuilt: integer('year_built').notNull(),
  floors: integer('floors').notNull(),
  entrances: integer('entrances').notNull(),
  totalAreaSqm: numeric('total_area_sqm', { precision: 10, scale: 2 }).notNull(),
  apartmentsCount: integer('apartments_count').notNull(),
  conditionScore: integer('condition_score').notNull().default(85),
  conditionStatus: text('condition_status').notNull().default('good'), // excellent | good | satisfactory | needs_repair
  managementSince: text('management_since').notNull(), // YYYY-MM-DD
  imageKey: text('image_key').notNull().default('building_modern_tower'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const apartments = pgTable('apartments', {
  id: serial('id').primaryKey(),
  buildingId: integer('building_id')
    .references(() => buildings.id, { onDelete: 'cascade' })
    .notNull(),
  number: text('number').notNull(),
  entrance: integer('entrance').notNull().default(1),
  floor: integer('floor').notNull().default(1),
  areaSqm: numeric('area_sqm', { precision: 8, scale: 2 }).notNull(),
  unitType: text('unit_type').notNull().default('residential'), // residential | commercial | technical
  ownerName: text('owner_name').notNull(),
  ownerPhone: text('owner_phone'),
  residentsCount: integer('residents_count').notNull().default(1),
});

export const engineeringSystems = pgTable('engineering_systems', {
  id: serial('id').primaryKey(),
  buildingId: integer('building_id')
    .references(() => buildings.id, { onDelete: 'cascade' })
    .notNull(),
  systemType: text('system_type').notNull(), // heating | water_supply | electricity | elevator | ventilation | roof_facade | gas
  name: text('name').notNull(),
  condition: text('condition').notNull().default('normal'), // normal | wear | critical
  wearPercent: integer('wear_percent').notNull().default(20),
  lastInspectionDate: text('last_inspection_date').notNull(),
  nextInspectionDate: text('next_inspection_date').notNull(),
  notes: text('notes'),
});

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash'),
  fullName: text('full_name').notNull(),
  phone: text('phone'),
  role: text('role').notNull().default('resident'), // admin | dispatcher | specialist | resident
  position: text('position'),
  brigadeId: integer('brigade_id').references(() => brigades.id, { onDelete: 'set null' }),
  buildingId: integer('building_id').references(() => buildings.id, { onDelete: 'set null' }),
  apartmentNumber: text('apartment_number'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const tickets = pgTable('tickets', {
  id: serial('id').primaryKey(),
  ticketNumber: text('ticket_number').notNull().unique(),
  buildingId: integer('building_id')
    .references(() => buildings.id, { onDelete: 'cascade' })
    .notNull(),
  apartmentNumber: text('apartment_number'),
  category: text('category').notNull(), // plumbing | electricity | heating | elevator | cleaning | roof_facade | intercom | other
  title: text('title').notNull(),
  description: text('description').notNull(),
  photoData: text('photo_data'),
  priority: text('priority').notNull().default('medium'), // low | medium | high | critical
  status: text('status').notNull().default('new'), // new | registered | assigned | in_progress | resolved | closed
  authorId: integer('author_id')
    .references(() => users.id, { onDelete: 'set null' }),
  dispatcherId: integer('dispatcher_id')
    .references(() => users.id, { onDelete: 'set null' }),
  assigneeId: integer('assignee_id')
    .references(() => users.id, { onDelete: 'set null' }),
  brigadeId: integer('brigade_id')
    .references(() => brigades.id, { onDelete: 'set null' }),
  slaDeadline: timestamp('sla_deadline'),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  resolutionNotes: text('resolution_notes'),
  afterPhotoData: text('after_photo_data'),
  residentRating: integer('resident_rating'),
  residentFeedback: text('resident_feedback'),
  laborCost: numeric('labor_cost', { precision: 10, scale: 2 }).notNull().default('0'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const ticketHistory = pgTable('ticket_history', {
  id: serial('id').primaryKey(),
  ticketId: integer('ticket_id')
    .references(() => tickets.id, { onDelete: 'cascade' })
    .notNull(),
  actorId: integer('actor_id').references(() => users.id, { onDelete: 'set null' }),
  actorName: text('actor_name').notNull(),
  action: text('action').notNull(),
  fromStatus: text('from_status'),
  toStatus: text('to_status'),
  comment: text('comment'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const ticketComments = pgTable('ticket_comments', {
  id: serial('id').primaryKey(),
  ticketId: integer('ticket_id')
    .references(() => tickets.id, { onDelete: 'cascade' })
    .notNull(),
  authorId: integer('author_id').references(() => users.id, { onDelete: 'set null' }),
  authorName: text('author_name').notNull(),
  authorRole: text('author_role').notNull(),
  message: text('message').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const meterReadings = pgTable('meter_readings', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  buildingId: integer('building_id')
    .references(() => buildings.id, { onDelete: 'cascade' })
    .notNull(),
  apartmentNumber: text('apartment_number').notNull(),
  meterType: text('meter_type').notNull(), // cold_water | hot_water | electricity
  period: text('period').notNull(), // YYYY-MM
  value: numeric('value', { precision: 10, scale: 2 }).notNull(),
  previousValue: numeric('previous_value', { precision: 10, scale: 2 }),
  consumption: numeric('consumption', { precision: 10, scale: 2 }),
  submittedAt: timestamp('submitted_at').defaultNow().notNull(),
});

export const warehouseItems = pgTable('warehouse_items', {
  id: serial('id').primaryKey(),
  sku: text('sku').notNull().unique(),
  name: text('name').notNull(),
  category: text('category').notNull(), // plumbing | electricity | heating | construction | fasteners | consumables
  unit: text('unit').notNull().default('шт'),
  quantity: integer('quantity').notNull().default(0),
  minQuantity: integer('min_quantity').notNull().default(5),
  unitPrice: numeric('unit_price', { precision: 10, scale: 2 }).notNull().default('0'),
  location: text('location').notNull().default('Основной склад'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const ticketMaterials = pgTable('ticket_materials', {
  id: serial('id').primaryKey(),
  ticketId: integer('ticket_id')
    .references(() => tickets.id, { onDelete: 'cascade' })
    .notNull(),
  itemId: integer('item_id')
    .references(() => warehouseItems.id, { onDelete: 'restrict' })
    .notNull(),
  quantityUsed: integer('quantity_used').notNull(),
  unitPriceAtUse: numeric('unit_price_at_use', { precision: 10, scale: 2 }).notNull(),
  recordedById: integer('recorded_by_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const maintenancePlans = pgTable('maintenance_plans', {
  id: serial('id').primaryKey(),
  buildingId: integer('building_id')
    .references(() => buildings.id, { onDelete: 'cascade' })
    .notNull(),
  systemId: integer('system_id').references(() => engineeringSystems.id, { onDelete: 'set null' }),
  title: text('title').notNull(),
  description: text('description').notNull(),
  frequency: text('frequency').notNull().default('quarterly'), // monthly | quarterly | semiannual | annual | once
  scheduledDate: text('scheduled_date').notNull(), // YYYY-MM-DD
  completedDate: text('completed_date'),
  status: text('status').notNull().default('planned'), // planned | in_progress | completed | overdue
  brigadeId: integer('brigade_id').references(() => brigades.id, { onDelete: 'set null' }),
  estimatedCost: numeric('estimated_cost', { precision: 10, scale: 2 }).notNull().default('0'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const emergencies = pgTable('emergencies', {
  id: serial('id').primaryKey(),
  buildingId: integer('building_id')
    .references(() => buildings.id, { onDelete: 'cascade' })
    .notNull(),
  systemType: text('system_type').notNull(),
  severity: text('severity').notNull().default('high'), // high | critical
  title: text('title').notNull(),
  description: text('description').notNull(),
  affectedApartments: text('affected_apartments').notNull().default('Весь подъезд'),
  status: text('status').notNull().default('active'), // active | localized | resolved
  brigadeId: integer('brigade_id').references(() => brigades.id, { onDelete: 'set null' }),
  reportedById: integer('reported_by_id').references(() => users.id, { onDelete: 'set null' }),
  reportedAt: timestamp('reported_at').defaultNow().notNull(),
  localizedAt: timestamp('localized_at'),
  resolvedAt: timestamp('resolved_at'),
  responseMinutes: integer('response_minutes'),
  damageCost: numeric('damage_cost', { precision: 10, scale: 2 }).notNull().default('0'),
  rootCause: text('root_cause'),
});

export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }),
  targetRole: text('target_role'), // null = all or specific userId
  buildingId: integer('building_id').references(() => buildings.id, { onDelete: 'cascade' }),
  type: text('type').notNull().default('system'), // ticket | emergency | maintenance | inventory | system
  title: text('title').notNull(),
  message: text('message').notNull(),
  isRead: boolean('is_read').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Drizzle Relations
export const buildingsRelations = relations(buildings, ({ many }) => ({
  apartments: many(apartments),
  engineeringSystems: many(engineeringSystems),
  tickets: many(tickets),
  maintenancePlans: many(maintenancePlans),
  emergencies: many(emergencies),
  meterReadings: many(meterReadings),
}));

export const apartmentsRelations = relations(apartments, ({ one }) => ({
  building: one(buildings, {
    fields: [apartments.buildingId],
    references: [buildings.id],
  }),
}));

export const engineeringSystemsRelations = relations(engineeringSystems, ({ one }) => ({
  building: one(buildings, {
    fields: [engineeringSystems.buildingId],
    references: [buildings.id],
  }),
}));

export const brigadesRelations = relations(brigades, ({ many }) => ({
  members: many(users),
  tickets: many(tickets),
  maintenancePlans: many(maintenancePlans),
  emergencies: many(emergencies),
}));

export const usersRelations = relations(users, ({ one }) => ({
  brigade: one(brigades, {
    fields: [users.brigadeId],
    references: [brigades.id],
  }),
  building: one(buildings, {
    fields: [users.buildingId],
    references: [buildings.id],
  }),
}));

export const ticketsRelations = relations(tickets, ({ one, many }) => ({
  building: one(buildings, {
    fields: [tickets.buildingId],
    references: [buildings.id],
  }),
  brigade: one(brigades, {
    fields: [tickets.brigadeId],
    references: [brigades.id],
  }),
  history: many(ticketHistory),
  comments: many(ticketComments),
  materials: many(ticketMaterials),
}));

export const ticketHistoryRelations = relations(ticketHistory, ({ one }) => ({
  ticket: one(tickets, {
    fields: [ticketHistory.ticketId],
    references: [tickets.id],
  }),
}));

export const ticketCommentsRelations = relations(ticketComments, ({ one }) => ({
  ticket: one(tickets, {
    fields: [ticketComments.ticketId],
    references: [tickets.id],
  }),
}));

export const meterReadingsRelations = relations(meterReadings, ({ one }) => ({
  building: one(buildings, {
    fields: [meterReadings.buildingId],
    references: [buildings.id],
  }),
}));

export const ticketMaterialsRelations = relations(ticketMaterials, ({ one }) => ({
  ticket: one(tickets, {
    fields: [ticketMaterials.ticketId],
    references: [tickets.id],
  }),
  item: one(warehouseItems, {
    fields: [ticketMaterials.itemId],
    references: [warehouseItems.id],
  }),
}));
