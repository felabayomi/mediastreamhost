#!/usr/bin/env node

const fetch = require('node-fetch');
const FormData = require('form-data');

// Configuration
const CONFIG = {
  MEDIA_HOST: process.env.MEDIA_HOST || 'https://your-replit-domain.replit.dev',
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
};

class GPTUploadCLI {
  constructor(mediaHost, openaiKey) {
    this.mediaHost = mediaHost;
    this.openaiKey = openaiKey;
  }

  async generateAndUpload(prompt, options = {}) {
    try {
      console.log(`🎨 Generating image for: "${prompt}"`);
      
      // Generate image with OpenAI
      const imageResponse = await this.generateImage(prompt, options);
      console.log(`✅ Generated ${imageResponse.data.length} image(s)`);
      
      const uploadedFiles = [];
      
      // Upload each generated image
      for (let i = 0; i < imageResponse.data.length; i++) {
        const imageData = imageResponse.data[i];
        console.log(`📤 Uploading image ${i + 1}...`);
        
        const uploadedFile = await this.uploadFromUrl(
          imageData.url,
          `gpt-${Date.now()}-${i}.png`
        );
        
        uploadedFiles.push({
          ...uploadedFile,
          revised_prompt: imageData.revised_prompt,
          original_prompt: prompt,
          embeddable_url: `${uploadedFile.embeddableUrl}?w=600&h=300&fit=crop&crop=center`
        });
        
        console.log(`✅ Uploaded: ${uploadedFile.embeddableUrl}`);
      }
      
      return uploadedFiles;
    } catch (error) {
      console.error('❌ Error:', error.message);
      throw error;
    }
  }

  async generateImage(prompt, options = {}) {
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt,
        size: options.size || '1024x1024',
        quality: options.quality || 'standard',
        style: options.style || 'vivid',
        n: options.n || 1,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`);
    }

    return response.json();
  }

  async uploadFromUrl(imageUrl, filename) {
    // Download image
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error(`Failed to download image: ${imageResponse.statusText}`);
    }

    const buffer = await imageResponse.buffer();
    
    // Upload to media service
    const formData = new FormData();
    formData.append('files', buffer, {
      filename,
      contentType: 'image/png',
    });

    const uploadResponse = await fetch(`${this.mediaHost}/api/media/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!uploadResponse.ok) {
      throw new Error(`Upload failed: ${uploadResponse.statusText}`);
    }

    const result = await uploadResponse.json();
    return result.files[0];
  }

  async directWebhook(prompt, options = {}) {
    console.log(`🚀 Using direct webhook for: "${prompt}"`);
    
    const response = await fetch(`${this.mediaHost}/api/gpt/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        openai_api_key: this.openaiKey,
        ...options
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Webhook error: ${error.message || response.statusText}`);
    }

    const result = await response.json();
    console.log(`✅ Generated and uploaded ${result.count} files via webhook`);
    return result.files;
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args.includes('--help')) {
    console.log(`
🎨 GPT Image Upload CLI

Usage:
  node gpt-upload-cli.js "your prompt here" [options]
  
Options:
  --size <size>        Image size (256x256, 512x512, 1024x1024, 1792x1024, 1024x1792)
  --quality <quality>  Image quality (standard, hd)
  --style <style>      Image style (vivid, natural)
  --count <n>          Number of images to generate (1-4)
  --webhook           Use direct webhook instead of step-by-step
  --host <url>        Media host URL (default: env MEDIA_HOST)
  --key <key>         OpenAI API key (default: env OPENAI_API_KEY)

Environment Variables:
  MEDIA_HOST          Your media hosting URL
  OPENAI_API_KEY      Your OpenAI API key

Examples:
  node gpt-upload-cli.js "A sunset over mountains"
  node gpt-upload-cli.js "Modern logo design" --size 1024x1024 --quality hd
  node gpt-upload-cli.js "Abstract art" --count 2 --webhook
    `);
    return;
  }

  const prompt = args[0];
  const options = {};
  let useWebhook = false;
  let mediaHost = CONFIG.MEDIA_HOST;
  let apiKey = CONFIG.OPENAI_API_KEY;

  // Parse arguments
  for (let i = 1; i < args.length; i += 2) {
    const flag = args[i];
    const value = args[i + 1];

    switch (flag) {
      case '--size':
        options.size = value;
        break;
      case '--quality':
        options.quality = value;
        break;
      case '--style':
        options.style = value;
        break;
      case '--count':
        options.n = parseInt(value);
        break;
      case '--webhook':
        useWebhook = true;
        i--; // No value for this flag
        break;
      case '--host':
        mediaHost = value;
        break;
      case '--key':
        apiKey = value;
        break;
    }
  }

  if (!apiKey) {
    console.error('❌ OpenAI API key required. Set OPENAI_API_KEY env var or use --key');
    process.exit(1);
  }

  if (!mediaHost) {
    console.error('❌ Media host URL required. Set MEDIA_HOST env var or use --host');
    process.exit(1);
  }

  try {
    const cli = new GPTUploadCLI(mediaHost, apiKey);
    
    let results;
    if (useWebhook) {
      results = await cli.directWebhook(prompt, options);
    } else {
      results = await cli.generateAndUpload(prompt, options);
    }

    console.log('\n🎉 Success! Generated URLs:');
    results.forEach((file, index) => {
      console.log(`\n📷 Image ${index + 1}:`);
      console.log(`   Direct: ${file.embeddableUrl}`);
      console.log(`   Resized: ${file.embeddableUrl}?w=600&h=300&fit=crop&crop=center`);
      console.log(`   HTML: <img src="${file.embeddableUrl}?w=600&h=300&fit=crop&crop=center" alt="${prompt}" />`);
    });

  } catch (error) {
    console.error('❌ Failed:', error.message);
    process.exit(1);
  }
}

// Auto-run if called directly
if (require.main === module) {
  main();
}

module.exports = { GPTUploadCLI };