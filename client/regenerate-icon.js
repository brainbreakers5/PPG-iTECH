#!/usr/bin/env node
/**
 * Icon Regenerator Script
 * This script reads the existing ppg-logo.png and creates a properly-sized
 * version with the logo centered and scaled to 70% of the canvas with 
 * transparent padding around it for proper desktop icon display.
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
const LOGO_SCALE = 0.70; // Logo takes 70% of the canvas

async function regenerateIcon() {
  try {
    console.log('🎨 Regenerating icon with centered logo...\n');

    // Check if original logo exists
    if (!fs.existsSync(LOGO_PATH)) {
      console.error('❌ Error: ppg-logo.png not found at', LOGO_PATH);
      process.exit(1);
    }

    // Create a white canvas and place the logo in the center
    for (const size of SIZES) {
      const logoSize = Math.floor(size * LOGO_SCALE);
      const padding = (size - logoSize) / 2;

      console.log(`📦 Processing ${size}x${size} icon (logo: ${logoSize}x${logoSize})...`);

      // Read original logo and resize it
      const resizedLogo = await sharp(LOGO_PATH)
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
            top: Math.floor(padding),
            left: Math.floor(padding)
          }
        ])
        .png()
        .toFile(`${OUTPUT_PATH}`);

      console.log(`✅ Generated ${size}x${size}`);
    }

    console.log('\n✨ Icon regenerated successfully!');
    console.log('The logo is now centered with proper padding.');
    console.log('\n💡 Tip: Clear your browser cache and reinstall the PWA to see the new icon.');
    
  } catch (error) {
    console.error('❌ Error regenerating icon:', error.message);
    process.exit(1);
  }
}

regenerateIcon();
