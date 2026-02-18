import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import multer from "multer";
import path from "path";
import fs from "fs";
import { promises as fsPromises } from "fs";
import { createHash } from "crypto";
import { insertMediaFileSchema, insertConversionSchema } from "@shared/schema";
import { z } from "zod";
import { GPTImageUploader } from "./gpt-integration";
import { backupService } from "./backup";
import sharp from "sharp";
import { randomBytes } from "crypto";

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

const apiUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024,
  },
});

function getFileType(mimeType: string): 'image' | 'video' {
  return mimeType.startsWith('image/') ? 'image' : 'video';
}

function generateEmbeddableUrl(filename: string): string {
  // Always use production domain for universal access across all platforms
  const productionDomain = 'mediahost.app';
  return `https://${productionDomain}/api/media/serve/${filename}`;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Redirect requests from old domain to new domain
  app.use((req, res, next) => {
    const host = req.get('host') || '';
    if (host.includes('image.citydiscoverer.ai')) {
      const newUrl = `https://mediahost.app${req.originalUrl}`;
      return res.redirect(301, newUrl);
    }
    next();
  });

  // Handle CORS preflight requests for media serving
  app.options('/api/media/serve/:filename', (req, res) => {
    res.set({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Authorization',
      'Access-Control-Max-Age': '86400',
    });
    res.status(204).send();
  });

  // Serve uploaded files with optional transformations
  app.get('/api/media/serve/:filename', async (req, res) => {
    const { filename } = req.params;
    const { w, h, fit, crop } = req.query;
    
    try {
      // Get file info from storage using efficient single-file lookup
      const file = await storage.getMediaFileByFilename(filename);
      
      if (!file) {
        return res.status(404).json({ message: 'File not found in database' });
      }

      // Generate ETag and Last-Modified for caching
      const lastModified = file.uploadedAt.toUTCString();
      let etag: string;
      let fileBuffer: Buffer | null = null;
      
      // Check if we have file content in database (new system)
      if (file.fileContent) {
        // Generate ETag from file content hash
        etag = `"${createHash('md5').update(file.fileContent).digest('hex')}"`;
        
        // Check conditional headers for 304 response
        const ifNoneMatch = req.headers['if-none-match'];
        const ifModifiedSince = req.headers['if-modified-since'];
        
        if (ifNoneMatch === etag || (ifModifiedSince && new Date(ifModifiedSince) >= file.uploadedAt)) {
          // Set caching headers for 304 response
          res.set({
            'Cache-Control': 'public, max-age=31536000, immutable',
            'ETag': etag,
            'Last-Modified': lastModified,
            'Access-Control-Allow-Origin': '*',
          });
          return res.status(304).end();
        }
        
        // Decode base64 only if we need to send the file
        fileBuffer = Buffer.from(file.fileContent, 'base64');
        
        // Set CORS headers for WordPress, Facebook, and external embedding
        res.set({
          'Content-Type': file.mimeType,
          'Cache-Control': 'public, max-age=31536000, immutable',
          'ETag': etag,
          'Last-Modified': lastModified,
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
          'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Referer, User-Agent',
          'X-Content-Type-Options': 'nosniff',
          'X-Frame-Options': 'SAMEORIGIN',
          'Referrer-Policy': 'no-referrer-when-downgrade',
          'Content-Length': fileBuffer.length.toString(),
          // Facebook-specific headers
          'X-Robots-Tag': 'noindex, nofollow',
          'Access-Control-Allow-Credentials': 'false',
        });
        
        return res.send(fileBuffer);
      }
      
      // Fallback to physical file for older uploads
      if (fs.existsSync(file.filePath)) {
        const stats = fs.statSync(file.filePath);
        const fileModified = stats.mtime.toUTCString();
        etag = `"${stats.size}-${stats.mtime.getTime()}"`;
        
        // Check conditional headers for 304 response
        const ifNoneMatch = req.headers['if-none-match'];
        const ifModifiedSince = req.headers['if-modified-since'];
        
        if (ifNoneMatch === etag || (ifModifiedSince && new Date(ifModifiedSince) >= stats.mtime)) {
          // Set caching headers for 304 response
          res.set({
            'Cache-Control': 'public, max-age=31536000, immutable',
            'ETag': etag,
            'Last-Modified': fileModified,
            'Access-Control-Allow-Origin': '*',
          });
          return res.status(304).end();
        }
        
        // Set CORS headers for WordPress, Facebook, and external embedding
        res.set({
          'Content-Type': file.mimeType,
          'Cache-Control': 'public, max-age=31536000, immutable',
          'ETag': etag,
          'Last-Modified': fileModified,
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
          'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Referer, User-Agent',
          'X-Content-Type-Options': 'nosniff',
          'X-Frame-Options': 'SAMEORIGIN',
          'Referrer-Policy': 'no-referrer-when-downgrade',
          // Facebook-specific headers
          'X-Robots-Tag': 'noindex, nofollow',
          'Access-Control-Allow-Credentials': 'false',
        });
        
        return res.sendFile(path.resolve(file.filePath));
      }
      
      // Neither database content nor physical file exists
      console.error(`File not found anywhere: ${filename}`);
      return res.status(404).json({ message: 'File content not available' });
      
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
      
      // Filter out files that have neither database content nor physical files
      // Since cache excludes fileContent for performance, use a dedicated method
      const availableFiles = await storage.getAvailableMediaFiles(files);
      
      res.json(availableFiles);
    } catch (error: any) {
      console.error('Media fetch error:', error);
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

        // Read file content and encode as base64 for database storage
        const fileContent = fs.readFileSync(file.path);
        const base64Content = fileContent.toString('base64');

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
          fileContent: base64Content,
        });

        uploadedFiles.push(mediaFile);
        
        // Clean up temporary file after storing in database
        try {
          fs.unlinkSync(file.path);
        } catch (cleanupError) {
          console.warn('Failed to cleanup temporary file:', file.path);
        }
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

      const baseUrl = 'https://mediahost.app';
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

  // Production sync endpoint - manually add files from production
  app.post("/api/admin/sync-production", async (req, res) => {
    try {
      const { files } = req.body;
      
      if (!files || !Array.isArray(files)) {
        return res.status(400).json({ 
          success: false, 
          message: 'Files array is required' 
        });
      }

      const syncedFiles = [];
      const currentDomain = process.env.REPLIT_DOMAINS || process.env.REPLIT_DEV_DOMAIN;
      
      for (const fileData of files) {
        try {
          // Check if file already exists
          const existingFiles = await storage.getAllMediaFiles();
          const exists = existingFiles.find(f => f.filename === fileData.filename);
          
          if (!exists) {
            // Update URL to use current domain
            const embeddableUrl = currentDomain 
              ? `https://${currentDomain}/api/media/serve/${fileData.filename}`
              : `http://localhost:5000/api/media/serve/${fileData.filename}`;
            
            // Create database entry for production file
            const mediaFile = await storage.createMediaFile({
              filename: fileData.filename,
              originalFilename: fileData.originalFilename || fileData.filename,
              fileType: fileData.fileType || 'image',
              mimeType: fileData.mimeType || 'image/jpeg',
              size: fileData.size || 0,
              width: fileData.width || null,
              height: fileData.height || null,
              filePath: `uploads/${fileData.filename}`,
              embeddableUrl
            });
            
            syncedFiles.push(mediaFile);
          }
        } catch (error) {
          console.error(`Error syncing file ${fileData.filename}:`, error);
        }
      }

      res.json({
        success: true,
        message: `Synced ${syncedFiles.length} files from production`,
        syncedFiles: syncedFiles.length,
        files: syncedFiles
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Production sync failed',
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

  // Public image proxy for Facebook and social media
  app.get('/img/:filename', async (req, res) => {
    try {
      const { filename } = req.params;
      const { w, h, q = 90 } = req.query;
      
      const files = await storage.getAllMediaFiles();
      const file = files.find(f => f.filename === filename);
      
      if (!file) {
        return res.status(404).send('Image not found');
      }

      if (!fs.existsSync(file.filePath)) {
        return res.status(404).send('Image file not found');
      }

      // Set headers optimized for social media crawlers
      res.set({
        'Content-Type': file.mimeType,
        'Cache-Control': 'public, max-age=31536000', // 1 year cache
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        'Access-Control-Allow-Headers': '*',
        'X-Content-Type-Options': 'nosniff',
        'Last-Modified': fs.statSync(file.filePath).mtime.toUTCString(),
        'ETag': `"${file.filename}-${fs.statSync(file.filePath).mtime.getTime()}"`,
        // Facebook-friendly headers
        'X-Robots-Tag': 'noindex, nofollow, noarchive, nosnippet',
        'Referrer-Policy': 'unsafe-url',
      });

      // Handle HEAD requests (used by Facebook for validation)
      if (req.method === 'HEAD') {
        return res.end();
      }

      // Serve file directly - TODO: add Sharp transformations for w, h, q parameters
      res.sendFile(path.resolve(file.filePath));
    } catch (error) {
      console.error('Public image serving error:', error);
      res.status(500).send('Error serving image');
    }
  });

  // WordPress shortcode generator endpoint
  app.get("/api/wordpress/shortcode/:filename", async (req, res) => {
    try {
      const { filename } = req.params;
      const { w = 600, h = 300, alt = 'hosted-image' } = req.query;
      
      const files = await storage.getAllMediaFiles();
      const file = files.find(f => f.filename === filename);
      
      if (!file) {
        return res.status(404).json({ message: 'File not found' });
      }

      const currentDomain = process.env.REPLIT_DOMAINS || process.env.REPLIT_DEV_DOMAIN;
      const baseUrl = currentDomain ? `https://${currentDomain}` : 'http://localhost:5000';
      const imageUrl = `${baseUrl}/api/media/serve/${filename}?w=${w}&h=${h}&fit=crop&crop=center&q=80`;
      
      // Generate WordPress-compatible shortcode
      const shortcode = `[embed]${imageUrl}[/embed]`;
      
      // Also provide HTML alternatives
      const htmlCode = `<img src="${imageUrl}" alt="${alt}" style="max-width: 100%; height: auto;" />`;
      const markdownCode = `![${alt}](${imageUrl})`;
      
      res.json({
        shortcode,
        html: htmlCode,
        markdown: markdownCode,
        directUrl: imageUrl,
        instructions: {
          shortcode: "Paste this shortcode directly into WordPress editor (works in both Visual and Text mode)",
          html: "Use this in WordPress Text/HTML editor mode only",
          markdown: "Use this in markdown-enabled editors"
        }
      });
    } catch (error) {
      res.status(500).json({ message: 'Failed to generate WordPress code' });
    }
  });

  // Image resize endpoint for device-specific dimensions
  app.post('/api/resize-image', async (req, res) => {
    try {
      const { url, base64, width, height, mode = 'scale' } = req.body;
      console.log(`Resize request: ${width}x${height}, mode: ${mode}, hasBase64: ${!!base64}, hasUrl: ${!!url}`);

      if ((!url && !base64) || !width || !height) {
        return res.status(400).json({ error: 'Image (URL or base64) and dimensions are required' });
      }

      let imageBuffer: Buffer;

      if (base64) {
        // Handle base64 image data
        const base64Data = base64.replace(/^data:image\/\w+;base64,/, '');
        console.log(`Base64 data length: ${base64Data.length}`);
        imageBuffer = Buffer.from(base64Data, 'base64');
        console.log(`Image buffer size: ${imageBuffer.length} bytes`);
      } else {
        // Check if this is a URL from our own server - if so, load directly from database
        const ourDomains = ['mediahost.app', 'localhost', '127.0.0.1'];
        const urlObj = new URL(url);
        const isOurServer = ourDomains.some(d => urlObj.hostname.includes(d));
        
        if (isOurServer && url.includes('/api/media/serve/')) {
          // Extract filename and load from database
          const filename = url.split('/api/media/serve/').pop()?.split('?')[0];
          console.log(`Loading image from database: ${filename}`);
          
          if (filename) {
            const file = await storage.getMediaFileByFilename(filename);
            if (file?.fileContent) {
              imageBuffer = Buffer.from(file.fileContent, 'base64');
              console.log(`Loaded from database: ${imageBuffer.length} bytes`);
            } else {
              return res.status(400).json({ error: 'Image not found in database' });
            }
          } else {
            return res.status(400).json({ error: 'Invalid image URL' });
          }
        } else {
          // Fetch the image from external URL
          const response = await fetch(url);
          if (!response.ok) {
            return res.status(400).json({ error: 'Failed to fetch image from URL' });
          }
          imageBuffer = Buffer.from(await response.arrayBuffer());
        }
      }

      // Re-encode the image to fix any corrupt/malformed data
      // This handles JPEGs with extraneous bytes or other issues
      // Use failOnError: false to be lenient with minor corruption
      try {
        imageBuffer = await sharp(imageBuffer, { failOnError: false })
          .png() // Convert to PNG to ensure clean data
          .toBuffer();
        console.log(`Image re-encoded successfully, new size: ${imageBuffer.length} bytes`);
      } catch (encodeError) {
        console.error('Failed to re-encode image:', encodeError);
        // Try one more time with even more lenient settings
        try {
          imageBuffer = await sharp(imageBuffer, { failOnError: false, limitInputPixels: false })
            .toBuffer();
          console.log('Image recovered with lenient settings');
        } catch (secondError) {
          console.error('Failed to recover image:', secondError);
          return res.status(400).json({ error: 'Image appears to be corrupted or in an unsupported format' });
        }
      }

      // Get resize options based on mode
      let resizeOptions: any = { width, height };
      let needsFlatten = false;
      let bgColor = { r: 255, g: 255, b: 255 };

      switch (mode) {
        case 'scale':
          // Scale proportionally - only specify width, height auto-calculates
          resizeOptions = { width, withoutEnlargement: false };
          break;
        case 'stretch':
          // Stretch to exact dimensions (may distort)
          resizeOptions = { width, height, fit: 'fill' as const };
          break;
        case 'crop':
          // Crop to fill exact dimensions (centers and crops excess)
          resizeOptions = { width, height, fit: 'cover' as const, position: 'center' };
          break;
        case 'contain':
          // Fit inside with background padding
          const { dominant } = await sharp(imageBuffer, { failOnError: false }).stats();
          bgColor = { r: dominant.r, g: dominant.g, b: dominant.b };
          resizeOptions = { width, height, fit: 'contain' as const, background: bgColor };
          needsFlatten = true;
          break;
        default:
          resizeOptions = { width, withoutEnlargement: false };
      }

      // Resize the image using sharp with lenient error handling
      let pipeline = sharp(imageBuffer, { failOnError: false }).resize(resizeOptions);
      if (needsFlatten) {
        pipeline = pipeline.flatten({ background: bgColor });
      }
      const resizedBuffer = await pipeline.png({ quality: 90 }).toBuffer();

      // Generate a unique filename for the resized image
      const hash = createHash('md5').update(resizedBuffer).digest('hex').substring(0, 16);
      const filename = `resized_${width}x${height}_${hash}.png`;
      const filePath = path.join(uploadsDir, filename);

      // Check if this file already exists
      const existingFile = await storage.getMediaFileByFilename(filename);
      if (existingFile) {
        const productionDomain = 'mediahost.app';
        return res.json({
          url: `https://${productionDomain}/api/media/serve/${filename}`,
          localUrl: `/api/media/serve/${filename}`,
          filename,
          width,
          height,
        });
      }

      // Save the resized image to database
      const base64Content = resizedBuffer.toString('base64');
      const newFile = await storage.createMediaFile({
        filename,
        originalFilename: `resized_${width}x${height}.png`,
        mimeType: 'image/png',
        size: resizedBuffer.length,
        filePath,
        embeddableUrl: generateEmbeddableUrl(filename),
        fileType: 'image',
        width,
        height,
        duration: null,
        thumbnailPath: null,
        fileContent: base64Content,
      });

      const productionDomain = 'mediahost.app';
      res.json({
        url: `https://${productionDomain}/api/media/serve/${filename}`,
        localUrl: `/api/media/serve/${filename}`,
        filename,
        width,
        height,
      });
    } catch (error) {
      console.error('Image resize error:', error);
      console.error('Resize error:', error);
      res.status(500).json({ error: 'Failed to resize image', details: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // --- ChatGPT External API ---

  const API_KEY_SETTING = 'mediahost_api_key';

  app.post('/api/generate-api-key', async (req, res) => {
    try {
      const { accessCode } = req.body;
      if (!accessCode) {
        return res.status(401).json({ error: 'Access code required' });
      }
      const result = await storage.verifyAccessCode(accessCode);
      if (!result.isValid || !result.user || result.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }
      const newKey = `mh_${randomBytes(24).toString('hex')}`;
      await storage.setSetting(API_KEY_SETTING, newKey);
      res.json({ apiKey: newKey });
    } catch (error) {
      res.status(500).json({ error: 'Failed to generate API key' });
    }
  });

  app.get('/api/api-key', async (req, res) => {
    try {
      const accessCode = req.headers['x-access-code'] as string;
      if (!accessCode) {
        return res.status(401).json({ error: 'Access code required' });
      }
      const result = await storage.verifyAccessCode(accessCode);
      if (!result.isValid || !result.user || result.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }
      const key = await storage.getSetting(API_KEY_SETTING);
      res.json({ apiKey: key, hasKey: !!key });
    } catch (error) {
      res.status(500).json({ error: 'Failed to get API key' });
    }
  });

  async function validateApiKey(req: any, res: any, next: any) {
    const authHeader = req.headers['authorization'] || '';
    console.log(`[API Auth] Authorization header present: ${!!authHeader}, length: ${authHeader.length}`);
    console.log(`[API Auth] Headers: ${JSON.stringify(Object.keys(req.headers))}`);
    let apiKey: string | null = null;
    if (authHeader.startsWith('Bearer ')) {
      apiKey = authHeader.slice(7).trim();
    } else if (authHeader.startsWith('bearer ')) {
      apiKey = authHeader.slice(7).trim();
    } else if (authHeader && !authHeader.includes(' ')) {
      apiKey = authHeader.trim();
    }
    const storedKey = await storage.getSetting(API_KEY_SETTING);
    console.log(`[API Auth] Received key starts with: ${apiKey?.substring(0, 6) || 'null'}, stored key starts with: ${storedKey?.substring(0, 6) || 'null'}`);
    if (!storedKey || !apiKey || apiKey !== storedKey) {
      console.error(`[API Auth] Authentication failed. Key match: ${apiKey === storedKey}`);
      return res.status(401).json({ error: 'Invalid or missing API key. Use Bearer token authentication.' });
    }
    console.log(`[API Auth] Authentication successful`);
    next();
  }

  async function processAndStoreImage(imageBuffer: Buffer, detectedMimeType: string, finalFilename: string, description?: string) {
    let metadata: any = {};
    try {
      const meta = await sharp(imageBuffer, { failOnError: false, limitInputPixels: false }).metadata();
      metadata = { width: meta.width, height: meta.height };
    } catch (e) {}

    const hash = createHash('md5').update(imageBuffer).digest('hex').substring(0, 16);
    const ext = path.extname(finalFilename) || '.png';
    const uniqueFilename = `${path.basename(finalFilename, ext)}_${hash}${ext}`;
    const filePath = path.join(uploadsDir, uniqueFilename);

    const base64Content = imageBuffer.toString('base64');
    const newFile = await storage.createMediaFile({
      filename: uniqueFilename,
      originalFilename: finalFilename,
      mimeType: detectedMimeType,
      size: imageBuffer.length,
      filePath,
      embeddableUrl: generateEmbeddableUrl(uniqueFilename),
      fileType: 'image',
      width: metadata.width || null,
      height: metadata.height || null,
      duration: null,
      thumbnailPath: null,
      fileContent: base64Content,
    });

    const productionDomain = 'mediahost.app';
    return {
      success: true,
      file: {
        id: newFile.id,
        filename: uniqueFilename,
        url: `https://${productionDomain}/api/media/serve/${uniqueFilename}`,
        embeddable_url: `https://${productionDomain}/api/media/serve/${uniqueFilename}`,
        width: metadata.width || null,
        height: metadata.height || null,
        size: imageBuffer.length,
        description: description || null,
      }
    };
  }

  // Handle GET requests to upload endpoint (ChatGPT sometimes probes with GET first)
  app.get('/api/v1/upload', (req, res) => {
    res.json({
      status: "ready",
      message: "MediaHost Pro Upload API is active. Use POST with multipart/form-data to upload images.",
      method: "POST",
      content_type: "multipart/form-data",
      required_fields: { file: "binary image file" },
      authentication: "Bearer token required in Authorization header"
    });
  });

  // Multipart file upload endpoint for ChatGPT Actions (preferred)
  app.post('/api/v1/upload', apiUpload.single('file'), validateApiKey, async (req, res) => {
    try {
      console.log(`[API Upload] Content-Type: ${req.headers['content-type']}`);
      console.log(`[API Upload] Has file: ${!!req.file}, Body keys: ${Object.keys(req.body || {}).join(', ')}`);

      let imageBuffer: Buffer;
      let detectedMimeType = 'image/png';
      let finalFilename = `chatgpt_${Date.now()}.png`;
      let description: string | undefined;

      if (req.file) {
        console.log(`[API Upload] Multipart file received: ${req.file.originalname}, size: ${req.file.size}, mimetype: ${req.file.mimetype}`);
        imageBuffer = req.file.buffer;
        detectedMimeType = req.file.mimetype || 'image/png';
        finalFilename = req.body?.filename || req.file.originalname || finalFilename;
        description = req.body?.description;
      } else if (req.body?.image_url) {
        const image_url = req.body.image_url;
        console.log(`[API Upload] Downloading image from URL: ${image_url.substring(0, 100)}...`);

        if (!image_url.startsWith('http://') && !image_url.startsWith('https://')) {
          console.error(`[API Upload] Invalid URL format: ${image_url.substring(0, 50)}`);
          return res.status(400).json({ 
            error: 'Invalid image URL. Must be a public https:// URL. If DALL-E gave you a file reference instead of a URL, please use multipart file upload instead.',
            hint: 'Try uploading the file directly using multipart/form-data with a "file" field.'
          });
        }

        const response = await fetch(image_url, {
          headers: { 'User-Agent': 'MediaHost/1.0' },
          redirect: 'follow',
        });
        if (!response.ok) {
          console.error(`[API Upload] Failed to download: ${response.status} ${response.statusText}`);
          return res.status(400).json({ error: `Failed to download image from URL: ${response.status} ${response.statusText}` });
        }
        const contentType = response.headers.get('content-type') || '';
        console.log(`[API Upload] Response: status=${response.status}, content-type=${contentType}`);
        const arrayBuffer = await response.arrayBuffer();
        imageBuffer = Buffer.from(arrayBuffer);
        console.log(`[API Upload] Downloaded ${imageBuffer.length} bytes`);
        if (imageBuffer.length < 100) {
          return res.status(400).json({ error: `Downloaded file is too small (${imageBuffer.length} bytes). The image URL may be expired. Try uploading the file directly instead.` });
        }
        detectedMimeType = contentType.split(';')[0] || 'image/png';
        finalFilename = req.body?.filename || finalFilename;
        description = req.body?.description;
      } else if (req.body?.image_base64) {
        console.log(`[API Upload] Base64 image received`);
        const base64Data = req.body.image_base64.replace(/^data:image\/\w+;base64,/, '');
        imageBuffer = Buffer.from(base64Data, 'base64');
        finalFilename = req.body?.filename || finalFilename;
        description = req.body?.description;
      } else {
        return res.status(400).json({ 
          error: 'No image provided. Send either: a "file" field (multipart), "image_url" (JSON), or "image_base64" (JSON).',
          supported_methods: [
            'multipart/form-data with "file" field (recommended)',
            'JSON with "image_url" field',
            'JSON with "image_base64" field'
          ]
        });
      }

      const result = await processAndStoreImage(imageBuffer, detectedMimeType, finalFilename, description);
      console.log(`[API Upload] Success: ${result.file.filename}, ${result.file.width}x${result.file.height}, ${result.file.size} bytes`);
      res.json(result);
    } catch (error) {
      console.error('[API Upload] Error:', error);
      res.status(500).json({ error: 'Failed to upload image', details: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post('/api/v1/generate', validateApiKey, async (req, res) => {
    try {
      const { prompt, size, quality, style } = req.body;

      if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
        return res.status(400).json({ error: 'A text prompt is required to generate an image.' });
      }

      if (!process.env.OPENAI_API_KEY) {
        return res.status(500).json({ error: 'OpenAI API key not configured on the server.' });
      }

      console.log(`[API Generate] Prompt: "${prompt.substring(0, 80)}...", size: ${size || '1024x1024'}, quality: ${quality || 'auto'}`);

      const validSizes = ['1024x1024', '1536x1024', '1024x1536', 'auto'];
      const chosenSize = validSizes.includes(size) ? size : 'auto';
      const chosenQuality = ['low', 'medium', 'high', 'auto'].includes(quality) ? quality : 'auto';

      const openaiRes = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-image-1',
          prompt: prompt.trim(),
          n: 1,
          size: chosenSize,
          quality: chosenQuality,
        }),
      });

      if (!openaiRes.ok) {
        const errBody = await openaiRes.text();
        console.error(`[API Generate] OpenAI error: ${openaiRes.status} ${errBody}`);
        return res.status(502).json({ error: `Image generation failed: ${openaiRes.status}`, details: errBody });
      }

      const openaiData = await openaiRes.json() as any;
      const imageB64 = openaiData.data?.[0]?.b64_json;

      if (!imageB64) {
        console.error('[API Generate] No b64_json in response');
        return res.status(502).json({ error: 'OpenAI did not return image data.' });
      }

      const imageBuffer = Buffer.from(imageB64, 'base64');
      const finalFilename = `generated_${Date.now()}.png`;
      console.log(`[API Generate] Image received: ${imageBuffer.length} bytes`);

      const result = await processAndStoreImage(imageBuffer, 'image/png', finalFilename, prompt.substring(0, 200));
      console.log(`[API Generate] Stored: ${result.file.url}`);

      res.json({
        success: true,
        file: result.file,
        prompt_used: prompt,
      });
    } catch (error) {
      console.error('[API Generate] Error:', error);
      res.status(500).json({ error: 'Failed to generate image', details: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Privacy policy for ChatGPT Actions
  app.get('/privacy', (req, res) => {
    res.send(`<!DOCTYPE html><html><head><title>MediaHost Pro - Privacy Policy</title></head><body style="max-width:800px;margin:40px auto;padding:0 20px;font-family:system-ui">
      <h1>MediaHost Pro Privacy Policy</h1>
      <p>Last updated: February 2026</p>
      <h2>Data We Collect</h2>
      <p>When you upload images via our API, we store the image file and associated metadata (filename, dimensions, file size). We do not collect personal information beyond what is necessary to provide the service.</p>
      <h2>How We Use Data</h2>
      <p>Uploaded images are stored to provide permanent hosting URLs. We do not sell, share, or use your images for any purpose other than hosting and serving them back to you.</p>
      <h2>Data Retention</h2>
      <p>Images remain hosted until you delete them from your MediaHost Pro account.</p>
      <h2>Contact</h2>
      <p>For questions about this policy, contact us through the MediaHost Pro platform.</p>
    </body></html>`);
  });

  // OpenAPI spec for ChatGPT Actions
  app.get('/api/openapi.json', (req, res) => {
    res.json({
      openapi: "3.1.0",
      info: {
        title: "MediaHost Pro API",
        description: "Generate AI images from text prompts or upload existing images to get permanent hosted URLs.",
        version: "2.0.0"
      },
      servers: [
        { url: "https://mediahost.app" }
      ],
      paths: {
        "/api/v1/generate": {
          post: {
            operationId: "generateImage",
            summary: "Generate an image from a text prompt and get a permanent hosted URL",
            description: "Send a text prompt and MediaHost will generate the image using AI, store it permanently, and return a hosted URL. This is the recommended way to create and host AI-generated images. No file upload needed — just send a prompt.",
            requestBody: {
              required: true,
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      prompt: {
                        type: "string",
                        description: "Text description of the image to generate"
                      },
                      size: {
                        type: "string",
                        enum: ["1024x1024", "1536x1024", "1024x1536", "auto"],
                        description: "Image size. Default is auto."
                      },
                      quality: {
                        type: "string",
                        enum: ["low", "medium", "high", "auto"],
                        description: "Image quality. Default is auto."
                      }
                    },
                    required: ["prompt"]
                  }
                }
              }
            },
            responses: {
              "200": {
                description: "Image generated and hosted successfully",
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      properties: {
                        success: { type: "boolean" },
                        file: {
                          type: "object",
                          properties: {
                            id: { type: "integer" },
                            filename: { type: "string" },
                            url: { type: "string", description: "Permanent URL to access the image" },
                            embeddable_url: { type: "string" },
                            width: { type: "integer" },
                            height: { type: "integer" },
                            size: { type: "integer" }
                          }
                        },
                        prompt_used: { type: "string" }
                      }
                    }
                  }
                }
              },
              "401": { description: "Invalid or missing API key" },
              "502": { description: "Image generation failed" }
            },
            security: [{ bearerAuth: [] }]
          }
        },
        "/api/v1/upload": {
          post: {
            operationId: "uploadImage",
            summary: "Upload an existing image file to get a permanent URL",
            description: "Upload an existing image file or URL. For AI image generation, use the /api/v1/generate endpoint instead.",
            requestBody: {
              required: true,
              content: {
                "multipart/form-data": {
                  schema: {
                    type: "object",
                    properties: {
                      file: {
                        type: "string",
                        format: "binary",
                        description: "The image file to upload"
                      },
                      filename: {
                        type: "string",
                        description: "Custom filename for the image"
                      },
                      description: {
                        type: "string",
                        description: "Description of the image"
                      }
                    },
                    required: ["file"]
                  }
                }
              }
            },
            responses: {
              "200": {
                description: "Image uploaded successfully",
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      properties: {
                        success: { type: "boolean" },
                        file: {
                          type: "object",
                          properties: {
                            id: { type: "integer" },
                            filename: { type: "string" },
                            url: { type: "string", description: "Permanent URL to access the image" },
                            embeddable_url: { type: "string" },
                            width: { type: "integer" },
                            height: { type: "integer" },
                            size: { type: "integer" }
                          }
                        }
                      }
                    }
                  }
                }
              },
              "401": { description: "Invalid or missing API key" }
            },
            security: [{ bearerAuth: [] }]
          }
        }
      },
      components: {
        schemas: {},
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            description: "API key from MediaHost Pro. Get it from the API Settings page."
          }
        }
      }
    });
  });

  const httpServer = createServer(app);
  return httpServer;
}
