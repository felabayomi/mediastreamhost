import { pgTable, text, serial, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const mediaFiles = pgTable("media_files", {
  id: serial("id").primaryKey(),
  filename: text("filename").notNull(),
  originalFilename: text("original_filename").notNull(),
  fileType: text("file_type").notNull(), // 'image' | 'video'
  mimeType: text("mime_type").notNull(),
  size: integer("size").notNull(), // in bytes
  width: integer("width"),
  height: integer("height"),
  duration: integer("duration"), // for videos, in seconds
  filePath: text("file_path").notNull(),
  thumbnailPath: text("thumbnail_path"),
  embeddableUrl: text("embeddable_url").notNull(),
  fileContent: text("file_content"), // base64 encoded file content for persistence
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
});

export const conversions = pgTable("conversions", {
  id: serial("id").primaryKey(),
  mediaFileId: integer("media_file_id").notNull(),
  fromFormat: text("from_format").notNull(),
  toFormat: text("to_format").notNull(),
  status: text("status").notNull(), // 'pending' | 'processing' | 'completed' | 'failed'
  progress: integer("progress").default(0), // 0-100
  outputPath: text("output_path"),
  embeddableUrl: text("embeddable_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  accessCode: text("access_code").notNull().unique(),
  role: text("role").notNull(), // 'admin' | 'developer' | 'user'
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastLogin: timestamp("last_login"),
});

export const insertMediaFileSchema = createInsertSchema(mediaFiles).omit({
  id: true,
  uploadedAt: true,
});

export const insertConversionSchema = createInsertSchema(conversions).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  lastLogin: true,
});

export type InsertMediaFile = z.infer<typeof insertMediaFileSchema>;
export type MediaFile = typeof mediaFiles.$inferSelect;
export type InsertConversion = z.infer<typeof insertConversionSchema>;
export type Conversion = typeof conversions.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
