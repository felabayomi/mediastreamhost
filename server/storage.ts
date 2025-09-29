import { mediaFiles, conversions, users, type MediaFile, type InsertMediaFile, type Conversion, type InsertConversion, type User, type InsertUser } from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, or, like } from "drizzle-orm";

export interface IStorage {
  // Media files
  getMediaFile(id: number): Promise<MediaFile | undefined>;
  getMediaFileByFilename(filename: string): Promise<MediaFile | undefined>;
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
  private mediaFilesCache: MediaFile[] | null = null;
  private cacheExpiry: number = 0;
  private readonly CACHE_DURATION = 60000; // 1 minute
  private isInitializing: boolean = false;

  constructor() {
    // Initialize cache immediately when the storage is created
    this.initializeCache();
  }

  private async initializeCache() {
    if (this.isInitializing) return;
    this.isInitializing = true;
    
    try {
      console.log('Initializing media files cache...');
      // Exclude large fileContent field to avoid loading massive amounts of data on startup
      const files = await db.select({
        id: mediaFiles.id,
        filename: mediaFiles.filename,
        originalFilename: mediaFiles.originalFilename,
        mimeType: mediaFiles.mimeType,
        size: mediaFiles.size,
        filePath: mediaFiles.filePath,
        embeddableUrl: mediaFiles.embeddableUrl,
        fileType: mediaFiles.fileType,
        width: mediaFiles.width,
        height: mediaFiles.height,
        duration: mediaFiles.duration,
        thumbnailPath: mediaFiles.thumbnailPath,
        uploadedAt: mediaFiles.uploadedAt,
      }).from(mediaFiles).orderBy(desc(mediaFiles.uploadedAt));
      
      // Add null fileContent to maintain type compatibility while saving memory
      this.mediaFilesCache = files.map(file => ({ ...file, fileContent: null }));
      this.cacheExpiry = Date.now() + this.CACHE_DURATION;
      console.log(`Initial cache loaded with ${files.length} files`);
    } catch (error) {
      console.error('Failed to initialize cache:', error);
    } finally {
      this.isInitializing = false;
    }
  }

  async getMediaFile(id: number): Promise<MediaFile | undefined> {
    const files = await this.getAllMediaFiles();
    return files.find(f => f.id === id);
  }

  async getMediaFileByFilename(filename: string): Promise<MediaFile | undefined> {
    try {
      const [file] = await db
        .select()
        .from(mediaFiles)
        .where(eq(mediaFiles.filename, filename))
        .limit(1);
      return file || undefined;
    } catch (error) {
      console.error('Database error fetching media file by filename:', error);
      return undefined;
    }
  }

  async getAllMediaFiles(): Promise<MediaFile[]> {
    // Return cached data if available and not expired
    if (this.mediaFilesCache && Date.now() < this.cacheExpiry) {
      return this.mediaFilesCache;
    }

    try {
      console.log('Fetching media files from database...');
      // Exclude large fileContent field to avoid massive payloads - it's only needed for serving individual files
      const files = await db.select({
        id: mediaFiles.id,
        filename: mediaFiles.filename,
        originalFilename: mediaFiles.originalFilename,
        mimeType: mediaFiles.mimeType,
        size: mediaFiles.size,
        filePath: mediaFiles.filePath,
        embeddableUrl: mediaFiles.embeddableUrl,
        fileType: mediaFiles.fileType,
        width: mediaFiles.width,
        height: mediaFiles.height,
        duration: mediaFiles.duration,
        thumbnailPath: mediaFiles.thumbnailPath,
        uploadedAt: mediaFiles.uploadedAt,
      }).from(mediaFiles).orderBy(desc(mediaFiles.uploadedAt));
      
      // Add null fileContent to maintain type compatibility while saving memory
      const filesWithNullContent = files.map(file => ({ ...file, fileContent: null }));
      
      // Update cache
      this.mediaFilesCache = filesWithNullContent;
      this.cacheExpiry = Date.now() + this.CACHE_DURATION;
      
      console.log(`Cached ${files.length} media files`);
      return filesWithNullContent;
    } catch (error) {
      console.error('Database error fetching media files:', error);
      // Return cached data if available, even if expired
      if (this.mediaFilesCache) {
        console.log('Returning stale cache due to database error');
        return this.mediaFilesCache;
      }
      return [];
    }
  }

  private invalidateCache() {
    this.mediaFilesCache = null;
    this.cacheExpiry = 0;
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
        fileContent: insertFile.fileContent ?? null,
      })
      .returning();
    
    // Invalidate cache after creating new file
    this.invalidateCache();
    return file;
  }

  async deleteMediaFile(id: number): Promise<void> {
    // Delete related conversions first
    await db.delete(conversions).where(eq(conversions.mediaFileId, id));
    // Then delete the media file
    await db.delete(mediaFiles).where(eq(mediaFiles.id, id));
    // Invalidate cache after deletion
    this.invalidateCache();
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
    // Check hardcoded admin access codes first
    if (code === '19770520$&?') {
      console.log('Admin access code verified: 19770520$&?');
      const adminUser: User = {
        id: 1,
        name: 'Admin User',
        email: 'admin@citydiscoverer.ai',
        accessCode: '19770520$&?',
        role: 'admin',
        isActive: true,
        createdAt: new Date(),
        lastLogin: null,
      };
      return { isValid: true, user: adminUser };
    }
    
    if (code === 'Bethel654356$') {
      console.log('Bethel admin access code verified: Bethel654356$');
      const bethelUser: User = {
        id: 2,
        name: 'Bethel Admin',
        email: 'bethel@citydiscoverer.ai',
        accessCode: 'Bethel654356$',
        role: 'admin',
        isActive: true,
        createdAt: new Date(),
        lastLogin: null,
      };
      return { isValid: true, user: bethelUser };
    }

    // Check database for other users
    try {
      const [user] = await db
        .select()
        .from(users)
        .where(and(eq(users.accessCode, code), eq(users.isActive, true)));
      
      if (user) {
        console.log('Database user verified:', user.name);
        return { isValid: true, user };
      }
      
      console.log('Access code not found:', code);
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
