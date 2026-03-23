#!/usr/bin/env node
/**
 * Icon Regenerator Script
 * This script reads the existing ppg-logo.png, trims excess whitespace,
 * and creates a properly-sized version with the logo scaled to maximum size
 * with minimal padding for proper desktop icon display.
 * 
 * Usage: node regenerate-icon.js
 */

import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOGO_PATH = path.join(__dirname, 'public', 'ppg-logo.png');
const OUTPUT_PATH = path.join(__dirname, 'public', 'ppg-logo.png');

// Icon sizes to generate
const SIZES = [144, 192, 256, 512];
const LOGO_SCALE = 0.95; // Logo takes 95% of the canvas for maximum visibility
const PADDING_PERCENT = 0.025; // Only 2.5% padding on each side

async function regenerateIcon() {
  try {
    console.log('🎨 Regenerating icon with optimized logo size...\n');

    // Check if original logo exists
    if (!fs.existsSync(LOGO_PATH)) {
      console.error('❌ Error: ppg-logo.png not found at', LOGO_PATH);
      process.exit(1);
    }

    // Read and trim the original logo to remove excess whitespace
    console.log('📦 Trimming excess whitespace from source logo...');
    const trimmedLogoBuffer = await sharp(LOGO_PATH)
      .trim({ threshold: 10 }) // Trim pixels with similar color to edges
      .toBuffer();

    // Get metadata of trimmed image
    const metadata = await sharp(trimmedLogoBuffer).metadata();
    console.log(`✅ Trimmed to ${metadata.width}x${metadata.height}px (removed whitespace)`);

    // Generate icons at each size
    for (const size of SIZES) {
      const logoSize = Math.floor(size * LOGO_SCALE);
      const padding = Math.floor(size * PADDING_PERCENT);

      console.log(`📦 Processing ${size}x${size} icon (logo: ${logoSize}x${logoSize}, padding: ${padding}px)...`);

      // Read trimmed logo and resize it
      const resizedLogo = await sharp(trimmedLogoBuffer)
        .resize(logoSize, logoSize, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 0 } // Transparent background
        })
        .toBuffer();

      // Create a new image with the resized logo centered
      await sharp({
        create: {
          width: size,
          height: size,
          channels: 4,
          background: { r: 255, g: 255, b: 255, alpha: 0 } // Transparent background
        }
      })
        .composite([
          {
            input: resizedLogo,
            top: padding,
            left: padding
          }
        ])
        .png()
        .toFile(OUTPUT_PATH);

      console.log(`✅ Generated ${size}x${size}`);
    }

    console.log('\n✨ Icon regenerated successfully!');
    console.log('The logo is now optimized for maximum visibility with minimal padding.');
    console.log('\n💡 Tip: Clear your browser cache and reinstall the PWA to see the new icon.');
    
  } catch (error) {
    console.error('❌ Error regenerating icon:', error.message);
    process.exit(1);
  }
}

regenerateIcon();
