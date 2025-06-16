#!/usr/bin/env node

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readdir, stat, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { createHash } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const uploadsDir = join(__dirname, '..', 'uploads');

// Function to detect file type from file signature
function detectFileType(buffer) {
  const signatures = {
    'image/jpeg': [0xFF, 0xD8, 0xFF],
    'image/png': [0x89, 0x50, 0x4E, 0x47],
    'image/gif': [0x47, 0x49, 0x46],
    'image/webp': [0x52, 0x49, 0x46, 0x46],
    'video/mp4': [0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70], // ftyp box
  };

  for (const [mimeType, signature] of Object.entries(signatures)) {
    if (signature.every((byte, index) => buffer[index] === byte)) {
      return mimeType;
    }
  }
  
  // Additional checks
  if (buffer.slice(0, 4).toString() === 'RIFF' && buffer.slice(8, 12).toString() === 'WEBP') {
    return 'image/webp';
  }
  
  return null;
}

// Function to get image dimensions
function getImageDimensions(buffer, mimeType) {
  try {
    if (mimeType === 'image/png') {
      const width = buffer.readUInt32BE(16);
      const height = buffer.readUInt32BE(20);
      return { width, height };
    } else if (mimeType === 'image/jpeg') {
      // Basic JPEG dimension extraction
      let offset = 2;
      while (offset < buffer.length) {
        if (buffer[offset] === 0xFF && (buffer[offset + 1] === 0xC0 || buffer[offset + 1] === 0xC2)) {
          const height = buffer.readUInt16BE(offset + 5);
          const width = buffer.readUInt16BE(offset + 7);
          return { width, height };
        }
        offset++;
      }
    }
  } catch (error) {
    console.warn('Could not extract dimensions:', error.message);
  }
  return { width: null, height: null };
}

async function recoverOrphanedFiles() {
  console.log('🔍 Scanning for orphaned media files...');
  
  try {
    // Get all files in uploads directory
    const files = await readdir(uploadsDir);
    const recoveredFiles = [];
    
    for (const filename of files) {
      if (filename === 'thumbnails') continue;
      
      const filePath = join(uploadsDir, filename);
      const stats = await stat(filePath);
      
      if (stats.isFile()) {
        try {
          // Read file header to detect type
          const buffer = await readFile(filePath);
          const mimeType = detectFileType(buffer.slice(0, 32));
          
          if (mimeType) {
            const { width, height } = getImageDimensions(buffer, mimeType);
            const fileType = mimeType.startsWith('image/') ? 'image' : 'video';
            
            const fileInfo = {
              filename,
              originalFilename: `recovered-${filename}`,
              fileType,
              mimeType,
              size: stats.size,
              width,
              height,
              filePath: `uploads/${filename}`,
              embeddableUrl: `https://699747a2-04a3-4e3d-9356-963b1661e36e-00-stlx8mu3ia68.worf.replit.dev/api/media/serve/${filename}`,
              uploadedAt: stats.mtime.toISOString()
            };
            
            recoveredFiles.push(fileInfo);
            console.log(`📁 Found: ${filename} (${mimeType}, ${stats.size} bytes)`);
          }
        } catch (error) {
          console.warn(`⚠️  Could not process ${filename}:`, error.message);
        }
      }
    }
    
    console.log(`\n✅ Recovery scan complete. Found ${recoveredFiles.length} media files.`);
    return recoveredFiles;
    
  } catch (error) {
    console.error('❌ Error during recovery scan:', error);
    return [];
  }
}

// Export for use in other modules
export { recoverOrphanedFiles };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  recoverOrphanedFiles().then(files => {
    console.log('\n📋 Recovery Summary:');
    files.forEach(file => {
      console.log(`- ${file.filename}: ${file.mimeType} (${file.size} bytes)`);
    });
  });
}