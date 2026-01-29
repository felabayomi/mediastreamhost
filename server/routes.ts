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
        // Fetch the image from URL
        const response = await fetch(url);
        if (!response.ok) {
          return res.status(400).json({ error: 'Failed to fetch image from URL' });
        }
        imageBuffer = Buffer.from(await response.arrayBuffer());
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

  const httpServer = createServer(app);
  return httpServer;
}
