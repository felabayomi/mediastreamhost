import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import multer from "multer";
import path from "path";
import fs from "fs";
import { promises as fsPromises } from "fs";
import { insertMediaFileSchema, insertConversionSchema } from "@shared/schema";
import { z } from "zod";
import { GPTImageUploader } from "./gpt-integration";
import { backupService } from "./backup";

// Ensure uploads directory exists
const uploadsDir = path.join(process.cwd(), "uploads");
const thumbnailsDir = path.join(uploadsDir, "thumbnails");

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
if (!fs.existsSync(thumbnailsDir)) {
  fs.mkdirSync(thumbnailsDir, { recursive: true });
}

// Configure multer for file uploads
const upload = multer({
  dest: uploadsDir,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'video/mp4', 'video/avi', 'video/mov', 'video/quicktime'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(null, false);
    }
  }
});

function getFileType(mimeType: string): 'image' | 'video' {
  return mimeType.startsWith('image/') ? 'image' : 'video';
}

function generateEmbeddableUrl(filename: string): string {
  // Always use the current production domain for universal access
  const currentDomain = process.env.REPLIT_DOMAINS || process.env.REPLIT_DEV_DOMAIN;
  
  if (currentDomain) {
    // Use the main domain for all URLs to ensure they work across environments
    const baseUrl = currentDomain.includes(',') ? currentDomain.split(',')[0].trim() : currentDomain;
    return `https://${baseUrl}/api/media/serve/${filename}`;
  }
  
  // Fallback for local development only
  return `http://localhost:5000/api/media/serve/${filename}`;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Serve uploaded files with optional transformations
  app.get('/api/media/serve/:filename', async (req, res) => {
    const { filename } = req.params;
    const { w, h, fit, crop } = req.query;
    
    try {
      // Get file info from storage first
      const files = await storage.getAllMediaFiles();
      const file = files.find(f => f.filename === filename);
      
      if (!file) {
        return res.status(404).json({ message: 'File not found in database' });
      }

      // Check if physical file exists using the stored file path
      if (!fs.existsSync(file.filePath)) {
        console.error(`Physical file not found: ${file.filePath}`);
        return res.status(404).json({ message: 'Physical file not found' });
      }

      // Set appropriate content type
      res.set('Content-Type', file.mimeType);
      res.set('Cache-Control', 'public, max-age=86400');
      
      // Use absolute path for sendFile
      res.sendFile(path.resolve(file.filePath));
    } catch (error) {
      console.error('File serving error:', error);
      res.status(500).json({ message: 'Failed to serve file' });
    }
  });

  // Get dashboard stats
  app.get('/api/stats', async (req, res) => {
    try {
      const stats = await storage.getStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: 'Failed to get stats' });
    }
  });

  // Get all media files
  app.get('/api/media', async (req, res) => {
    try {
      const { search, type } = req.query;
      let files;
      
      if (search) {
        files = await storage.searchMediaFiles(search as string, type as string);
      } else {
        files = await storage.getAllMediaFiles();
        if (type) {
          files = files.filter(file => file.fileType === type);
        }
      }
      
      res.json(files);
    } catch (error) {
      res.status(500).json({ message: 'Failed to get media files' });
    }
  });

  // Upload media files
  app.post('/api/media/upload', upload.array('files', 10), async (req, res) => {
    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return res.status(400).json({ message: 'No files uploaded' });
      }

      const uploadedFiles = [];

      for (const file of files) {
        const fileType = getFileType(file.mimetype);
        const embeddableUrl = generateEmbeddableUrl(file.filename);

        const mediaFile = await storage.createMediaFile({
          filename: file.filename,
          originalFilename: file.originalname,
          fileType,
          mimeType: file.mimetype,
          size: file.size,
          width: null, // TODO: Extract dimensions with Sharp/FFmpeg
          height: null,
          duration: null,
          filePath: file.path,
          thumbnailPath: null, // TODO: Generate thumbnails
          embeddableUrl,
        });

        uploadedFiles.push(mediaFile);
      }

      res.json({ files: uploadedFiles });
    } catch (error) {
      console.error('Upload error:', error);
      res.status(500).json({ message: 'Failed to upload files' });
    }
  });

  // Delete media file
  app.delete('/api/media/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const file = await storage.getMediaFile(id);
      
      if (!file) {
        return res.status(404).json({ message: 'File not found' });
      }

      // Delete physical file
      if (fs.existsSync(file.filePath)) {
        fs.unlinkSync(file.filePath);
      }

      // Delete thumbnail if exists
      if (file.thumbnailPath && fs.existsSync(file.thumbnailPath)) {
        fs.unlinkSync(file.thumbnailPath);
      }

      await storage.deleteMediaFile(id);
      res.json({ message: 'File deleted successfully' });
    } catch (error) {
      res.status(500).json({ message: 'Failed to delete file' });
    }
  });

  // Get all conversions
  app.get('/api/conversions', async (req, res) => {
    try {
      const conversions = await storage.getAllConversions();
      res.json(conversions);
    } catch (error) {
      res.status(500).json({ message: 'Failed to get conversions' });
    }
  });

  // Create conversion
  app.post('/api/conversions', async (req, res) => {
    try {
      const validatedData = insertConversionSchema.parse(req.body);
      const conversion = await storage.createConversion(validatedData);
      
      // TODO: Start actual conversion process here
      // For now, simulate with timeout
      setTimeout(async () => {
        await storage.updateConversion(conversion.id, {
          status: 'completed',
          progress: 100,
          outputPath: `converted_${conversion.id}_${Date.now()}`,
          embeddableUrl: generateEmbeddableUrl(`converted_${conversion.id}_${Date.now()}`),
        });
      }, 3000);

      res.json(conversion);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid conversion data', errors: error.errors });
      }
      res.status(500).json({ message: 'Failed to create conversion' });
    }
  });

  // Removed GPT generation endpoint to avoid API costs

  // Automated GPT Image Generation and Upload
  app.post('/api/gpt/generate', async (req, res) => {
    try {
      const { prompt, format, style } = req.body;
      
      if (!prompt) {
        return res.status(400).json({ message: 'Prompt is required' });
      }

      if (!process.env.OPENAI_API_KEY) {
        return res.status(500).json({ message: 'OpenAI API key not configured' });
      }

      const baseUrl = 'https://image.citydiscoverer.ai';
      const uploader = new GPTImageUploader(process.env.OPENAI_API_KEY, baseUrl);
      
      // Map style to OpenAI parameters
      let openaiStyle: 'vivid' | 'natural' = 'vivid';
      let quality: 'standard' | 'hd' = 'standard';
      
      if (style === 'cinematic' || style === 'realistic') {
        openaiStyle = 'natural';
        quality = 'hd';
      } else if (style === 'painterly' || style === 'artistic') {
        openaiStyle = 'vivid';
      }

      const uploadedFiles = await uploader.generateAndUpload({
        prompt,
        size: '1024x1024',
        quality,
        style: openaiStyle,
        n: 1
      });

      const file = uploadedFiles[0];
      
      res.json({
        url: `${file.embeddableUrl}?w=1200&h=800&fit=crop&crop=center`,
        filename: file.originalFilename,
        status: 'success',
        file_id: file.id,
        direct_url: file.embeddableUrl,
        variations: {
          thumbnail: `${file.embeddableUrl}?w=300&h=300&fit=crop&crop=center`,
          banner: `${file.embeddableUrl}?w=1200&h=400&fit=crop&crop=center`,
          square: `${file.embeddableUrl}?w=800&h=800&fit=crop&crop=center`
        }
      });
    } catch (error) {
      console.error('GPT generation error:', error);
      res.status(500).json({ 
        message: 'Failed to generate and upload image',
        error: error instanceof Error ? error.message : 'Unknown error',
        status: 'error'
      });
    }
  });

  // Access code verification
  app.post("/api/access/verify", async (req, res) => {
    try {
      const { code } = req.body;
      if (!code) {
        return res.status(400).json({ message: "Access code required" });
      }
 
      const result = await storage.verifyAccessCode(code);
      
      if (result.isValid && result.user) {
        res.json({
          success: true,
          userId: result.user.id,
          userName: result.user.name,
          role: result.user.role
        });
      } else {
        res.status(401).json({ message: "Invalid access code" });
      }
    } catch (error) {
      console.error('Authentication error:', error);
      res.status(500).json({ message: "Verification failed" });
    }
  });





  // Base64 upload endpoint
  app.post('/api/upload-base64', async (req, res) => {
    try {
      const { base64, filename } = req.body;
      
      if (!base64) {
        return res.status(400).json({ message: 'Base64 data is required' });
      }

      if (!filename) {
        return res.status(400).json({ message: 'Filename is required' });
      }

      // Validate base64 format
      const base64Regex = /^data:image\/(png|jpeg|jpg|gif|webp);base64,(.+)$/;
      const match = base64.match(base64Regex);
      
      if (!match) {
        return res.status(400).json({ 
          message: 'Invalid base64 format. Expected: data:image/[type];base64,[data]' 
        });
      }

      const [, imageType, base64Data] = match;
      const buffer = Buffer.from(base64Data, 'base64');
      
      if (buffer.length === 0) {
        return res.status(400).json({ message: 'Invalid or empty base64 data' });
      }

      // Ensure filename has correct extension
      const cleanFilename = filename.toLowerCase();
      const expectedExt = imageType === 'jpeg' ? 'jpg' : imageType;
      const hasCorrectExt = cleanFilename.endsWith(`.${expectedExt}`) || 
                           (expectedExt === 'jpg' && cleanFilename.endsWith('.jpeg'));
      
      const finalFilename = hasCorrectExt ? filename : `${filename}.${expectedExt}`;
      const filePath = path.join(uploadsDir, finalFilename);

      // Ensure uploads directory exists
      await fsPromises.mkdir(uploadsDir, { recursive: true });

      // Save file
      await fsPromises.writeFile(filePath, buffer);

      // Get image dimensions
      let width, height;
      try {
        const sharp = require('sharp');
        const metadata = await sharp(buffer).metadata();
        width = metadata.width;
        height = metadata.height;
      } catch (error) {
        console.error('Error getting image metadata:', error);
      }

      const embeddableUrl = generateEmbeddableUrl(finalFilename);
      const mimeType = `image/${imageType}`;

      const mediaFile = await storage.createMediaFile({
        filename: finalFilename,
        originalFilename: filename,
        fileType: 'image',
        mimeType,
        size: buffer.length,
        width,
        height,
        filePath,
        embeddableUrl
      });

      res.json({
        success: true,
        message: 'Base64 image uploaded successfully',
        embeddableUrl: mediaFile.embeddableUrl,
        url: mediaFile.embeddableUrl,
        file: mediaFile,
        variations: {
          thumbnail: `${mediaFile.embeddableUrl}?w=300&h=300&fit=crop&crop=center`,
          banner: `${mediaFile.embeddableUrl}?w=1200&h=400&fit=crop&crop=center`,
          fullsize: `${mediaFile.embeddableUrl}?w=1200&h=800&fit=crop&crop=center`
        }
      });
    } catch (error) {
      console.error('Base64 upload error:', error);
      res.status(500).json({ 
        message: 'Failed to process base64 upload',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });



  // Data recovery endpoint
  app.post("/api/admin/recover-data", async (req, res) => {
    try {
      console.log('Starting data recovery scan...');
      
      // Create backup before recovery
      await backupService.createDatabaseBackup();
      
      // Get all files in uploads directory
      const uploadFiles = await fsPromises.readdir(uploadsDir);
      const existingFiles = await storage.getAllMediaFiles();
      const existingFilenames = new Set(existingFiles.map(f => f.filename));
      
      const recoveredFiles = [];
      
      for (const filename of uploadFiles) {
        if (filename === 'thumbnails' || existingFilenames.has(filename)) continue;
        
        const filePath = path.join(uploadsDir, filename);
        const stats = await fsPromises.stat(filePath);
        
        if (stats.isFile()) {
          try {
            // Read file header to detect type
            const buffer = await fsPromises.readFile(filePath, { encoding: null });
            let mimeType = 'image/jpeg'; // default
            let fileType = 'image';
            
            // Basic file type detection
            if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
              mimeType = 'image/png';
            } else if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
              mimeType = 'image/jpeg';
            } else if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
              mimeType = 'image/gif';
            }
            
            // Extract dimensions for PNG images
            let width = null, height = null;
            if (mimeType === 'image/png' && buffer.length >= 24) {
              width = buffer.readUInt32BE(16);
              height = buffer.readUInt32BE(20);
            }
            
            // Create database entry
            const newFile = await storage.createMediaFile({
              filename,
              originalFilename: `recovered-${filename}`,
              fileType,
              mimeType,
              size: stats.size,
              width,
              height,
              filePath: `uploads/${filename}`,
              embeddableUrl: generateEmbeddableUrl(filename)
            });
            
            recoveredFiles.push(newFile);
            console.log(`Recovered: ${filename}`);
            
          } catch (error) {
            console.warn(`Could not recover ${filename}:`, error instanceof Error ? error.message : 'Unknown error');
          }
        }
      }
      
      res.json({
        success: true,
        message: `Recovery complete. Restored ${recoveredFiles.length} files.`,
        recoveredFiles: recoveredFiles.length,
        files: recoveredFiles
      });
      
    } catch (error) {
      console.error('Recovery error:', error);
      res.status(500).json({
        success: false,
        message: 'Recovery failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Create manual backup endpoint
  app.post("/api/admin/backup", async (req, res) => {
    try {
      const backupFile = await backupService.createDatabaseBackup();
      res.json({
        success: true,
        message: 'Backup created successfully',
        backupFile: path.basename(backupFile)
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Backup failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // List backups endpoint
  app.get("/api/admin/backups", async (req, res) => {
    try {
      const backups = await backupService.listBackups();
      res.json({ success: true, backups });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to list backups',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
