import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import multer from "multer";
import path from "path";
import fs from "fs";
import { insertMediaFileSchema, insertConversionSchema } from "@shared/schema";
import { z } from "zod";
import { GPTImageUploader } from "./gpt-integration";

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
      cb(new Error('Invalid file type. Only images and videos are allowed.'), false);
    }
  }
});

function getFileType(mimeType: string): 'image' | 'video' {
  return mimeType.startsWith('image/') ? 'image' : 'video';
}

function generateEmbeddableUrl(filename: string): string {
  const baseUrl = process.env.REPLIT_DOMAINS?.split(',')[0] || 'localhost:5000';
  return `https://${baseUrl}/api/media/serve/${filename}`;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Serve uploaded files with optional transformations
  app.get('/api/media/serve/:filename', async (req, res) => {
    const { filename } = req.params;
    const { w, h, fit, crop } = req.query;
    const filePath = path.join(uploadsDir, filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'File not found' });
    }

    // Get file info from storage to determine MIME type
    const files = await storage.getAllMediaFiles();
    const file = files.find(f => f.filename === filename);
    
    if (!file) {
      return res.status(404).json({ message: 'File not found' });
    }

    // Set appropriate content type
    res.set('Content-Type', file.mimeType);
    
    // For now, just serve the original file
    // TODO: Implement actual image transformations with Sharp
    res.sendFile(filePath);
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

  // Image Upload Webhook (for external image generators)
  app.post('/api/gpt/generate', async (req, res) => {
    try {
      const { prompt, format, style } = req.body;
      
      if (!prompt) {
        return res.status(400).json({ message: 'Prompt is required' });
      }

      // This endpoint is designed to work with external image generators
      // It expects the external service to generate the image and provide a URL
      // For now, we'll return a ready-to-use upload endpoint URL
      
      const baseUrl = process.env.REPLIT_DOMAINS?.split(',')[0] 
        ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`
        : 'http://localhost:5000';

      res.json({
        message: 'Ready to receive generated image',
        upload_endpoint: `${baseUrl}/api/upload-from-url`,
        instructions: 'POST the generated image URL to the upload_endpoint',
        prompt: prompt,
        format: format || 'image',
        style: style || 'default'
      });
    } catch (error) {
      console.error('Webhook error:', error);
      res.status(500).json({ 
        message: 'Webhook error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Upload from URL endpoint (for external integrations)
  app.post('/api/upload-from-url', async (req, res) => {
    try {
      const { url, filename } = req.body;
      
      if (!url) {
        return res.status(400).json({ message: 'URL is required' });
      }

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to download from URL: ${response.statusText}`);
      }

      const buffer = await response.arrayBuffer();
      const contentType = response.headers.get('content-type') || 'application/octet-stream';
      
      // Determine file extension from content type or URL
      let ext = '';
      if (contentType.includes('image/jpeg')) ext = '.jpg';
      else if (contentType.includes('image/png')) ext = '.png';
      else if (contentType.includes('image/gif')) ext = '.gif';
      else if (contentType.includes('image/webp')) ext = '.webp';
      else if (url.includes('.')) ext = '.' + url.split('.').pop()?.split('?')[0];
      
      const finalFilename = filename || `download-${Date.now()}${ext}`;
      const fileType = getFileType(contentType);
      const tempPath = path.join(uploadsDir, `temp-${Date.now()}${ext}`);
      
      // Save file temporarily
      fs.writeFileSync(tempPath, Buffer.from(buffer));
      
      const embeddableUrl = generateEmbeddableUrl(path.basename(tempPath));
      
      const mediaFile = await storage.createMediaFile({
        filename: path.basename(tempPath),
        originalFilename: finalFilename,
        fileType,
        mimeType: contentType,
        size: buffer.byteLength,
        width: null,
        height: null,
        duration: null,
        filePath: tempPath,
        thumbnailPath: null,
        embeddableUrl,
      });

      res.json({ file: mediaFile });
    } catch (error) {
      console.error('Upload from URL error:', error);
      res.status(500).json({ 
        message: 'Failed to upload from URL',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
