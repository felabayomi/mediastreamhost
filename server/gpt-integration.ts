import fetch from 'node-fetch';
import FormData from 'form-data';
import { storage } from './storage';
import path from 'path';
import fs from 'fs';

interface GPTImageRequest {
  prompt: string;
  size?: '256x256' | '512x512' | '1024x1024' | '1792x1024' | '1024x1792';
  quality?: 'standard' | 'hd';
  style?: 'vivid' | 'natural';
  n?: number;
}

interface GPTImageResponse {
  created: number;
  data: Array<{
    url: string;
    revised_prompt?: string;
  }>;
}

export class GPTImageUploader {
  private openaiApiKey: string;
  private baseUrl: string;

  constructor(openaiApiKey: string, baseUrl: string) {
    this.openaiApiKey = openaiApiKey;
    this.baseUrl = baseUrl;
  }

  async generateAndUpload(request: GPTImageRequest): Promise<any[]> {
    try {
      // Generate image with OpenAI
      const imageResponse = await this.generateImage(request);
      
      const uploadedFiles = [];
      
      // Download and upload each generated image
      for (let index = 0; index < imageResponse.data.length; index++) {
        const imageData = imageResponse.data[index];
        const uploadedFile = await this.downloadAndUpload(
          imageData.url,
          `gpt-generated-${Date.now()}-${index}.png`,
          request.prompt
        );
        uploadedFiles.push({
          ...uploadedFile,
          revised_prompt: imageData.revised_prompt,
          original_prompt: request.prompt
        });
      }
      
      return uploadedFiles;
    } catch (error) {
      console.error('Error in generateAndUpload:', error);
      throw error;
    }
  }

  private async generateImage(request: GPTImageRequest): Promise<GPTImageResponse> {
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt: request.prompt,
        size: request.size || '1024x1024',
        quality: request.quality || 'standard',
        style: request.style || 'vivid',
        n: request.n || 1,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    return response.json() as Promise<GPTImageResponse>;
  }

  private async downloadAndUpload(imageUrl: string, filename: string, prompt: string) {
    // Download image from OpenAI
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error(`Failed to download image: ${imageResponse.statusText}`);
    }

    const buffer = await imageResponse.buffer();
    
    // Create form data for upload
    const formData = new FormData();
    formData.append('files', buffer, {
      filename,
      contentType: 'image/png',
    });

    // Upload to our media service
    const uploadResponse = await fetch(`${this.baseUrl}/api/media/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!uploadResponse.ok) {
      throw new Error(`Upload failed: ${uploadResponse.statusText}`);
    }

    const uploadResult = await uploadResponse.json() as any;
    return uploadResult.files[0];
  }
}

// Utility function for external scripts
export async function uploadImageFromUrl(
  imageUrl: string, 
  filename: string, 
  baseUrl: string
): Promise<any> {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.statusText}`);
  }

  const buffer = await response.buffer();
  const formData = new FormData();
  formData.append('files', buffer, {
    filename,
    contentType: response.headers.get('content-type') || 'image/png',
  });

  const uploadResponse = await fetch(`${baseUrl}/api/media/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!uploadResponse.ok) {
    throw new Error(`Upload failed: ${uploadResponse.statusText}`);
  }

  const result = await uploadResponse.json() as any;
  return result.files[0];
}