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
  const baseUrl = 'image.citydiscoverer.ai';
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

  // URL to media converter
  app.post('/api/convert-url', async (req, res) => {
    try {
      const { imageUrl, title } = req.body;
      
      if (!imageUrl) {
        return res.status(400).json({ message: 'Image URL is required' });
      }

      // Don't allow converting URLs from the current domain to prevent loops
      const currentDomain = req.get('host') || 'localhost:5000';
      if (imageUrl.includes(currentDomain)) {
        return res.status(400).json({ 
          message: 'Cannot convert URLs from your own domain. Use external image URLs from other websites instead.' 
        });
      }

      // Add proper headers to mimic a browser request
      const response = await fetch(imageUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to download image: ${response.status} ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type') || '';
      
      // Validate content type is actually an image
      if (!contentType.startsWith('image/')) {
        throw new Error(`URL does not point to an image. Content-Type: ${contentType}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      // Additional validation - check if buffer contains image data
      if (buffer.length === 0) {
        throw new Error('Downloaded file is empty');
      }

      // Check for HTML content (common issue)
      const bufferStart = buffer.toString('utf8', 0, Math.min(100, buffer.length));
      if (bufferStart.toLowerCase().includes('<!doctype') || bufferStart.toLowerCase().includes('<html')) {
        throw new Error('URL returned HTML instead of image data. Please check the URL is a direct link to an image file.');
      }

      // Generate filename - use title if provided, otherwise convert timestamp
      const baseFilename = title || `converted-${Date.now()}`;
      const extension = contentType.includes('png') ? 'png' : 
                       contentType.includes('gif') ? 'gif' :
                       contentType.includes('webp') ? 'webp' : 'jpg';
      const filename = title ? `${baseFilename.replace(/[^a-zA-Z0-9-]/g, '-')}.${extension}` : `${baseFilename.replace(/[^a-zA-Z0-9-]/g, '-')}-${Date.now()}.${extension}`;
      const filePath = path.join('uploads', filename);

      // Ensure uploads directory exists
      await fsPromises.mkdir('uploads', { recursive: true });

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
        // If sharp fails, we'll continue without dimensions
      }

      const embeddableUrl = generateEmbeddableUrl(filename);

      const mediaFile = await storage.createMediaFile({
        filename,
        originalFilename: `${baseFilename}.${extension}`,
        fileType: 'image',
        mimeType: contentType,
        size: buffer.length,
        width,
        height,
        filePath,
        embeddableUrl
      });

      res.json({
        success: true,
        message: 'Image converted successfully',
        embeddableUrl: mediaFile.embeddableUrl,
        directUrl: `https://image.citydiscoverer.ai${mediaFile.embeddableUrl}`,
        variations: {
          thumbnail: `https://image.citydiscoverer.ai${mediaFile.embeddableUrl}?w=300&h=300&fit=crop&crop=center`,
          banner: `https://image.citydiscoverer.ai${mediaFile.embeddableUrl}?w=1200&h=400&fit=crop&crop=center`,
          fullsize: `https://image.citydiscoverer.ai${mediaFile.embeddableUrl}?w=1200&h=800&fit=crop&crop=center`
        }
      });
    } catch (error) {
      console.error('Image conversion error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to convert image';
      res.status(500).json({ message: errorMessage });
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
      const filePath = path.join('uploads', finalFilename);

      // Ensure uploads directory exists
      await fsPromises.mkdir('uploads', { recursive: true });

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
        url: `https://image.citydiscoverer.ai${mediaFile.embeddableUrl}`,
        file: mediaFile,
        variations: {
          thumbnail: `https://image.citydiscoverer.ai${mediaFile.embeddableUrl}?w=300&h=300&fit=crop&crop=center`,
          banner: `https://image.citydiscoverer.ai${mediaFile.embeddableUrl}?w=1200&h=400&fit=crop&crop=center`,
          fullsize: `https://image.citydiscoverer.ai${mediaFile.embeddableUrl}?w=1200&h=800&fit=crop&crop=center`
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

  // Image proxy endpoint - serves external images through your domain
  app.get('/api/proxy/image', async (req, res) => {
    try {
      const { url } = req.query;
      
      if (!url || typeof url !== 'string') {
        return res.status(400).json({ message: 'URL parameter is required' });
      }

      // Validate URL format
      try {
        new URL(url);
      } catch {
        return res.status(400).json({ message: 'Invalid URL format' });
      }

      // Don't proxy our own domain to prevent loops
      const currentDomain = req.get('host') || 'localhost:5000';
      if (url.includes(currentDomain)) {
        return res.status(400).json({ message: 'Cannot proxy URLs from the same domain' });
      }

      // Fetch the image with proper headers
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Referer': new URL(url).origin,
        }
      });

      if (!response.ok) {
        return res.status(response.status).json({ 
          message: `Failed to fetch image: ${response.status} ${response.statusText}` 
        });
      }

      const contentType = response.headers.get('content-type') || 'image/jpeg';
      
      // Validate it's actually an image
      if (!contentType.startsWith('image/')) {
        return res.status(400).json({ 
          message: `URL does not serve an image. Content-Type: ${contentType}` 
        });
      }

      // Set appropriate headers for image response
      res.set({
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
      });

      // Stream the image data directly to the client
      const imageBuffer = await response.arrayBuffer();
      res.send(Buffer.from(imageBuffer));

    } catch (error) {
      console.error('Image proxy error:', error);
      res.status(500).json({ 
        message: 'Failed to proxy image',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
