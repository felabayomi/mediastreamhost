import { mediaFiles, conversions, users, type MediaFile, type InsertMediaFile, type Conversion, type InsertConversion, type User, type InsertUser } from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, or, like } from "drizzle-orm";

export interface IStorage {
  // Media files
  getMediaFile(id: number): Promise<MediaFile | undefined>;
  getAllMediaFiles(): Promise<MediaFile[]>;
  createMediaFile(file: InsertMediaFile): Promise<MediaFile>;
  deleteMediaFile(id: number): Promise<void>;
  searchMediaFiles(query: string, fileType?: string): Promise<MediaFile[]>;
  
  // Conversions
  getConversion(id: number): Promise<Conversion | undefined>;
  getConversionsByMediaFile(mediaFileId: number): Promise<Conversion[]>;
  getAllConversions(): Promise<Conversion[]>;
  createConversion(conversion: InsertConversion): Promise<Conversion>;
  updateConversion(id: number, updates: Partial<Conversion>): Promise<Conversion | undefined>;
  
  // Stats
  getStats(): Promise<{
    totalFiles: number;
    totalSize: number;
    totalConversions: number;
    totalUrls: number;
  }>;

  // Users and access codes
  verifyAccessCode(code: string): Promise<{ isValid: boolean; user: User | null }>;
  getUserById(id: number): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserLastLogin(id: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getMediaFile(id: number): Promise<MediaFile | undefined> {
    const [file] = await db.select().from(mediaFiles).where(eq(mediaFiles.id, id));
    return file || undefined;
  }

  async getAllMediaFiles(): Promise<MediaFile[]> {
    return await db.select().from(mediaFiles).orderBy(desc(mediaFiles.uploadedAt));
  }

  async createMediaFile(insertFile: InsertMediaFile): Promise<MediaFile> {
    const [file] = await db
      .insert(mediaFiles)
      .values({
        ...insertFile,
        width: insertFile.width ?? null,
        height: insertFile.height ?? null,
        duration: insertFile.duration ?? null,
        thumbnailPath: insertFile.thumbnailPath ?? null,
      })
      .returning();
    return file;
  }

  async deleteMediaFile(id: number): Promise<void> {
    // Delete related conversions first
    await db.delete(conversions).where(eq(conversions.mediaFileId, id));
    // Then delete the media file
    await db.delete(mediaFiles).where(eq(mediaFiles.id, id));
  }

  async searchMediaFiles(query: string, fileType?: string): Promise<MediaFile[]> {
    let whereCondition = or(
      like(mediaFiles.originalFilename, `%${query}%`),
      like(mediaFiles.filename, `%${query}%`)
    );

    if (fileType) {
      whereCondition = and(
        whereCondition,
        eq(mediaFiles.fileType, fileType)
      );
    }

    return await db
      .select()
      .from(mediaFiles)
      .where(whereCondition)
      .orderBy(desc(mediaFiles.uploadedAt));
  }

  async getConversion(id: number): Promise<Conversion | undefined> {
    const [conversion] = await db.select().from(conversions).where(eq(conversions.id, id));
    return conversion || undefined;
  }

  async getConversionsByMediaFile(mediaFileId: number): Promise<Conversion[]> {
    return await db
      .select()
      .from(conversions)
      .where(eq(conversions.mediaFileId, mediaFileId))
      .orderBy(desc(conversions.createdAt));
  }

  async getAllConversions(): Promise<Conversion[]> {
    return await db.select().from(conversions).orderBy(desc(conversions.createdAt));
  }

  async createConversion(insertConversion: InsertConversion): Promise<Conversion> {
    const [conversion] = await db
      .insert(conversions)
      .values({
        ...insertConversion,
        progress: insertConversion.progress ?? 0,
        outputPath: insertConversion.outputPath ?? null,
        embeddableUrl: insertConversion.embeddableUrl ?? null,
      })
      .returning();
    return conversion;
  }

  async updateConversion(id: number, updates: Partial<Conversion>): Promise<Conversion | undefined> {
    const updateData: any = { ...updates };
    
    if (updates.status === 'completed' && !updates.completedAt) {
      updateData.completedAt = new Date();
    }

    const [updated] = await db
      .update(conversions)
      .set(updateData)
      .where(eq(conversions.id, id))
      .returning();
      
    return updated || undefined;
  }

  async getStats(): Promise<{
    totalFiles: number;
    totalSize: number;
    totalConversions: number;
    totalUrls: number;
  }> {
    const [fileStats] = await db
      .select({
        count: mediaFiles.id,
        totalSize: mediaFiles.size,
      })
      .from(mediaFiles);

    const files = await db.select().from(mediaFiles);
    const conversionCount = await db.select().from(conversions);
    
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    
    return {
      totalFiles: files.length,
      totalSize,
      totalConversions: conversionCount.length,
      totalUrls: files.length, // Each file gets an embeddable URL
    };
  }

  // User management methods
  async verifyAccessCode(code: string): Promise<{ isValid: boolean; user: User | null }> {
    try {
      const [user] = await db
        .select()
        .from(users)
        .where(and(eq(users.accessCode, code), eq(users.isActive, true)));
      
      if (user) {
        await this.updateUserLastLogin(user.id);
        return { isValid: true, user };
      }
      
      return { isValid: false, user: null };
    } catch (error) {
      console.error('Error verifying access code:', error);
      return { isValid: false, user: null };
    }
  }

  async getUserById(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async updateUserLastLogin(id: number): Promise<void> {
    await db
      .update(users)
      .set({ lastLogin: new Date() })
      .where(eq(users.id, id));
  }
}

export const storage = new DatabaseStorage();
