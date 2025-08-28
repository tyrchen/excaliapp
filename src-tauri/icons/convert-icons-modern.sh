#!/bin/bash

# OwnExcaliDesk Icon Conversion Script (Modern Version)
# This script converts SVG icons to various formats needed for Tauri
# Uses the modern 'magick' command instead of deprecated 'convert'

echo "🎨 Converting OwnExcaliDesk SVG icons to various formats (Modern Version)..."

# Check if ImageMagick is installed
if ! command -v magick &> /dev/null; then
    echo "❌ ImageMagick not found. Please install it first:"
    echo "   macOS: brew install imagemagick"
    echo "   Ubuntu/Debian: sudo apt-get install imagemagick"
    echo "   Windows: Download from https://imagemagick.org/"
    exit 1
fi

# Create backup of original icons
echo "📦 Creating backup of original icons..."
mkdir -p backup
cp *.png *.ico *.icns backup/ 2>/dev/null || true

# Convert main icon.svg to various sizes
echo "🔄 Converting main icon.svg..."

# Main icon sizes
magick icon.svg -resize 32x32 icon-32.png
magick icon.svg -resize 128x128 icon-128.png
magick icon.svg -resize 128x128 icon-128@2x.png

# Square logo sizes
magick icon.svg -resize 30x30 Square30x30Logo.png
magick icon.svg -resize 44x44 Square44x44Logo.png
magick icon.svg -resize 71x71 Square71x71Logo.png
magick icon.svg -resize 89x89 Square89x89Logo.png
magick icon.svg -resize 107x107 Square107x107Logo.png
magick icon.svg -resize 142x142 Square142x142Logo.png
magick icon.svg -resize 150x150 Square150x150Logo.png
magick icon.svg -resize 284x284 Square284x284Logo.png
magick icon.svg -resize 310x310 Square310x310Logo.png

# Store logo
magick icon.svg -resize 150x150 StoreLogo.png

# Convert to ICO format
magick icon.svg -resize 32x32 icon.ico

# Convert to PNG (main icon)
magick icon.svg -resize 128x128 icon.png

# Convert to 128x128 PNG
magick icon.svg -resize 128x128 128x128.png

# Convert to 128x128@2x PNG
magick icon.svg -resize 256x256 128x128@2x.png

# Convert to 32x32 PNG
magick icon.svg -resize 32x32 32x32.png

echo "✅ Icon conversion completed!"
echo ""
echo "📁 Generated files:"
echo "   - icon.png (128x128)"
echo "   - icon.ico (32x32)"
echo "   - 128x128.png"
echo "   - 128x128@2x.png"
echo "   - 32x32.png"
echo "   - Square*Logo.png (various sizes)"
echo "   - StoreLogo.png"
echo ""
echo "💡 Note: For macOS .icns files, you may need to use iconutil or online converters"
echo "   The PNG files can be used directly in most cases."
echo ""
echo "🔒 Original icons backed up in 'backup/' directory"
echo ""
echo "🎯 All icons converted using modern ImageMagick commands (no warnings!)"
echo "🚀 OwnExcaliDesk icons ready for use!"
