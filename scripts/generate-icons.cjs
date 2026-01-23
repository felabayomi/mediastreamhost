const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const outputDir = path.join(__dirname, '../client/public/icons');

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

async function generateIcons() {
  const svgIcon = `
    <svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
      <rect width="512" height="512" rx="80" fill="#2563eb"/>
      <path d="M256 120 L380 200 L380 360 L256 440 L132 360 L132 200 Z" fill="white" opacity="0.9"/>
      <circle cx="256" cy="260" r="60" fill="#2563eb"/>
      <path d="M240 240 L280 260 L240 280 Z" fill="white"/>
      <rect x="180" y="380" width="152" height="20" rx="10" fill="white" opacity="0.7"/>
    </svg>
  `;

  const svgBuffer = Buffer.from(svgIcon);

  for (const size of sizes) {
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(path.join(outputDir, `icon-${size}x${size}.png`));
    console.log(`Generated icon-${size}x${size}.png`);
  }
  
  console.log('All icons generated successfully!');
}

generateIcons().catch(console.error);
