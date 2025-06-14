import { mediaFiles, conversions, type MediaFile, type InsertMediaFile, type Conversion, type InsertConversion } from "@shared/schema";

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
}

export class MemStorage implements IStorage {
  private mediaFiles: Map<number, MediaFile>;
  private conversions: Map<number, Conversion>;
  private currentMediaId: number;
  private currentConversionId: number;

  constructor() {
    this.mediaFiles = new Map();
    this.conversions = new Map();
    this.currentMediaId = 1;
    this.currentConversionId = 1;
  }

  async getMediaFile(id: number): Promise<MediaFile | undefined> {
    return this.mediaFiles.get(id);
  }

  async getAllMediaFiles(): Promise<MediaFile[]> {
    return Array.from(this.mediaFiles.values()).sort((a, b) => 
      new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
    );
  }

  async createMediaFile(insertFile: InsertMediaFile): Promise<MediaFile> {
    const id = this.currentMediaId++;
    const file: MediaFile = {
      ...insertFile,
      id,
      uploadedAt: new Date(),
    };
    this.mediaFiles.set(id, file);
    return file;
  }

  async deleteMediaFile(id: number): Promise<void> {
    this.mediaFiles.delete(id);
    // Also delete related conversions
    for (const [convId, conversion] of this.conversions.entries()) {
      if (conversion.mediaFileId === id) {
        this.conversions.delete(convId);
      }
    }
  }

  async searchMediaFiles(query: string, fileType?: string): Promise<MediaFile[]> {
    const files = Array.from(this.mediaFiles.values());
    return files.filter(file => {
      const matchesQuery = file.originalFilename.toLowerCase().includes(query.toLowerCase()) ||
                          file.filename.toLowerCase().includes(query.toLowerCase());
      const matchesType = !fileType || file.fileType === fileType;
      return matchesQuery && matchesType;
    });
  }

  async getConversion(id: number): Promise<Conversion | undefined> {
    return this.conversions.get(id);
  }

  async getConversionsByMediaFile(mediaFileId: number): Promise<Conversion[]> {
    return Array.from(this.conversions.values()).filter(conv => conv.mediaFileId === mediaFileId);
  }

  async getAllConversions(): Promise<Conversion[]> {
    return Array.from(this.conversions.values()).sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async createConversion(insertConversion: InsertConversion): Promise<Conversion> {
    const id = this.currentConversionId++;
    const conversion: Conversion = {
      ...insertConversion,
      id,
      createdAt: new Date(),
      completedAt: null,
    };
    this.conversions.set(id, conversion);
    return conversion;
  }

  async updateConversion(id: number, updates: Partial<Conversion>): Promise<Conversion | undefined> {
    const conversion = this.conversions.get(id);
    if (!conversion) return undefined;
    
    const updated = { ...conversion, ...updates };
    if (updates.status === 'completed' && !updated.completedAt) {
      updated.completedAt = new Date();
    }
    
    this.conversions.set(id, updated);
    return updated;
  }

  async getStats(): Promise<{
    totalFiles: number;
    totalSize: number;
    totalConversions: number;
    totalUrls: number;
  }> {
    const files = Array.from(this.mediaFiles.values());
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    
    return {
      totalFiles: files.length,
      totalSize,
      totalConversions: this.conversions.size,
      totalUrls: files.length, // Each file gets an embeddable URL
    };
  }
}

export const storage = new MemStorage();
