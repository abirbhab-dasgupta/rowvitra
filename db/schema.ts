import { pgTable, text, timestamp, boolean, uuid, jsonb, integer, uniqueIndex } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const user = pgTable('user', {
  id: text('id').primaryKey(), name: text('name').notNull(), email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').default(false).notNull(), image: text('image'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
export const session = pgTable('session', {
  id: text('id').primaryKey(), expiresAt: timestamp('expires_at', {withTimezone:true}).notNull(),
  token: text('token').notNull().unique(), createdAt: timestamp('created_at', {withTimezone:true}).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', {withTimezone:true}).defaultNow().notNull(),
  ipAddress: text('ip_address'), userAgent: text('user_agent'), userId: text('user_id').notNull().references(()=>user.id,{onDelete:'cascade'}),
});
export const account = pgTable('account', {
  id: text('id').primaryKey(), accountId: text('account_id').notNull(), providerId: text('provider_id').notNull(),
  userId: text('user_id').notNull().references(()=>user.id,{onDelete:'cascade'}),
  accessToken: text('access_token'), refreshToken: text('refresh_token'), idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at',{withTimezone:true}),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at',{withTimezone:true}),
  scope: text('scope'), password: text('password'),
  createdAt: timestamp('created_at',{withTimezone:true}).defaultNow().notNull(),
  updatedAt: timestamp('updated_at',{withTimezone:true}).defaultNow().notNull(),
});
export const verification = pgTable('verification', {
  id: text('id').primaryKey(), identifier: text('identifier').notNull(), value: text('value').notNull(),
  expiresAt: timestamp('expires_at',{withTimezone:true}).notNull(),
  createdAt: timestamp('created_at',{withTimezone:true}).defaultNow().notNull(),
  updatedAt: timestamp('updated_at',{withTimezone:true}).defaultNow().notNull(),
});

export const datasets = pgTable('datasets', {
  id: uuid('id').defaultRandom().primaryKey(), userId: text('user_id').notNull().references(()=>user.id,{onDelete:'cascade'}),
  name: text('name').notNull(), goal: text('goal').notNull().default(''),
  currentVersionId: uuid('current_version_id'),
  createdAt: timestamp('created_at',{withTimezone:true}).defaultNow().notNull(),
  updatedAt: timestamp('updated_at',{withTimezone:true}).defaultNow().notNull(),
});
export const datasetVersions = pgTable('dataset_versions', {
  id: uuid('id').defaultRandom().primaryKey(), datasetId: uuid('dataset_id').notNull().references(()=>datasets.id,{onDelete:'cascade'}),
  parentVersionId: uuid('parent_version_id'), publicId: text('public_id').notNull(),
  csvHash: text('csv_hash').notNull(),
  operations: jsonb('operations').$type<Array<{operation:string;column?:string;parameters?:Record<string,unknown>}>>().notNull().default([]),
  createdAt: timestamp('created_at',{withTimezone:true}).defaultNow().notNull(),
});
export const auditEvents = pgTable('audit_events', {
  id: uuid('id').defaultRandom().primaryKey(), datasetId: uuid('dataset_id').notNull().references(()=>datasets.id,{onDelete:'cascade'}),
  versionId: uuid('version_id').notNull().references(()=>datasetVersions.id,{onDelete:'cascade'}),
  userId: text('user_id').notNull().references(()=>user.id),
  action: text('action').notNull(), details: jsonb('details').notNull().default({}),
  createdAt: timestamp('created_at',{withTimezone:true}).defaultNow().notNull(),
});
export const savedCharts = pgTable('saved_charts', {
  id: uuid('id').defaultRandom().primaryKey(), datasetId: uuid('dataset_id').notNull().references(()=>datasets.id,{onDelete:'cascade'}),
  userId: text('user_id').notNull().references(()=>user.id),
  title: text('title').notNull(), spec: jsonb('spec').$type<Record<string,unknown>>().notNull(),
  createdAt: timestamp('created_at',{withTimezone:true}).defaultNow().notNull(),
});
export const dataRules = pgTable('data_rules', {
  id: uuid('id').defaultRandom().primaryKey(), datasetId: uuid('dataset_id').notNull().references(()=>datasets.id,{onDelete:'cascade'}),
  column: text('column').notNull(), type: text('type').notNull(), options: jsonb('options').notNull().default({}),
  createdAt: timestamp('created_at',{withTimezone:true}).defaultNow().notNull(),
});
export const userRelations = relations(user, ({many})=>({sessions:many(session),accounts:many(account)}));
export const sessionsRelations = relations(session,({one})=>({user:one(user,{fields:[session.userId],references:[user.id]})}));
export const accountsRelations = relations(account,({one})=>({user:one(user,{fields:[account.userId],references:[user.id]})}));
