import { storage } from "./storage";
import { promises as fs } from "fs";
import path from "path";

export class DataBackupService {
  private backupDir = path.join(process.cwd(), "backups");

  constructor() {
    this.ensureBackupDir();
  }

  private async ensureBackupDir() {
    try {
      await fs.mkdir(this.backupDir, { recursive: true });
    } catch (error) {
      console.error("Failed to create backup directory:", error);
    }
  }

  async createDatabaseBackup() {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFile = path.join(this.backupDir, `media_backup_${timestamp}.json`);
      
      const mediaFiles = await storage.getAllMediaFiles();
      const conversions = await storage.getAllConversions();
      
      const backup = {
        timestamp: new Date().toISOString(),
        version: "1.0",
        data: {
          mediaFiles,
          conversions
        }
      };
      
      await fs.writeFile(backupFile, JSON.stringify(backup, null, 2));
      console.log(`Database backup created: ${backupFile}`);
      return backupFile;
    } catch (error) {
      console.error("Backup creation failed:", error);
      throw error;
    }
  }

  async restoreFromBackup(backupFilePath: string) {
    try {
      const backupData = JSON.parse(await fs.readFile(backupFilePath, 'utf-8'));
      
      // Restore media files
      for (const mediaFile of backupData.data.mediaFiles) {
        try {
          await storage.createMediaFile({
            filename: mediaFile.filename,
            originalFilename: mediaFile.originalFilename,
            fileType: mediaFile.fileType,
            mimeType: mediaFile.mimeType,
            size: mediaFile.size,
            width: mediaFile.width,
            height: mediaFile.height,
            duration: mediaFile.duration,
            filePath: mediaFile.filePath,
            thumbnailPath: mediaFile.thumbnailPath,
            embeddableUrl: mediaFile.embeddableUrl
          });
        } catch (error) {
          console.warn(`Failed to restore media file ${mediaFile.filename}:`, error);
        }
      }
      
      console.log(`Restored ${backupData.data.mediaFiles.length} media files from backup`);
      return true;
    } catch (error) {
      console.error("Restore failed:", error);
      throw error;
    }
  }

  async listBackups() {
    try {
      const files = await fs.readdir(this.backupDir);
      return files.filter(f => f.startsWith('media_backup_') && f.endsWith('.json'));
    } catch (error) {
      return [];
    }
  }
}

export const backupService = new DataBackupService();