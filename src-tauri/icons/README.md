# OwnExcaliDesk Icons

This directory contains modern SVG icons designed for OwnExcaliDesk, a Tauri-based desktop drawing and flowchart design application built on Excalidraw.

## Icon Design

### Main Icon: `icon.svg`
- **Design Concept**: Represents ownership, desktop application, and drawing capabilities
- **Features**: 
  - **Desktop Element**: Monitor/computer representing desktop application
  - **Ownership Symbol**: Crown representing "Own" aspect
  - **Drawing Tool**: Pencil representing Excalidraw capabilities
  - **Drawing Elements**: Basic shapes (circle, square, triangle, line) showing drawing features
  - **Modern Gradients**: Professional color scheme with depth
  - **App Name**: "OwnExcaliDesk" clearly displayed

## Design Elements

### Core Symbols
- **Desktop Monitor**: Represents desktop application and computer interface
- **Crown**: Symbolizes ownership and control over the application
- **Pencil Tool**: Represents Excalidraw's drawing and design capabilities
- **Combination**: Shows the integration of desktop ownership with drawing tools

### Drawing Elements
- **Circle**: Represents free-form drawing and creativity
- **Square**: Represents structured design and organization
- **Triangle**: Represents geometric shapes and mathematical precision
- **Line**: Represents connections, flow, and relationships
- **Connection Dots**: Represent nodes and connection points in diagrams

### Color Scheme
- **Primary**: Blue gradients (professional, trustworthy, tech-focused)
- **Desktop**: Green gradients (desktop, application, interface)
- **Drawing**: Orange gradients (creative, energetic, drawing tools)
- **Ownership**: Red gradients (ownership, control, power)
- **Accent**: Purple gradients (modern, innovative, design)
- **Background**: White with subtle transparency for clean appearance

## Usage Guidelines

### For Tauri Application
1. **Primary Icon**: Use `icon.svg` as the main app icon
2. **Different Sizes**: The SVG can be scaled to any size without quality loss
3. **Platform Icons**: Convert to PNG/ICO/ICNS for different platforms

### For Web/UI
1. **Favicon**: Use scaled versions for web favicons
2. **UI Elements**: Use for modern web interfaces
3. **Branding**: Use for corporate materials and marketing

### Conversion to Other Formats
```bash
# Convert SVG to PNG using ImageMagick
magick icon.svg -resize 128x128 icon.png

# Convert SVG to ICO using ImageMagick
magick icon.svg -resize 32x32 icon.ico

# Convert SVG to ICNS for macOS
# Use tools like iconutil or online converters
```

## Technical Specifications

- **Format**: SVG (Scalable Vector Graphics)
- **Viewport**: 128x128 pixels
- **Colors**: RGB with opacity support
- **Gradients**: Linear gradients for modern appearance
- **Filters**: Drop shadow effects for depth
- **Compatibility**: Works in all modern browsers and applications

## Customization

The SVG file is designed to be easily customizable:
- **Colors**: Modify the gradient definitions in the `<defs>` section
- **Shapes**: Adjust coordinates and dimensions for different layouts
- **Elements**: Add or remove drawing elements as needed
- **Size**: Scale by modifying the viewBox or width/height attributes

## Design Philosophy

The icon represents the core concept of "OwnExcaliDesk":
- **Own**: Crown symbol represents ownership and control
- **Excali**: Pencil and drawing elements represent Excalidraw functionality
- **Desk**: Desktop monitor represents desktop application

This creates a cohesive visual identity that clearly communicates the application's purpose: a desktop drawing application that you own and control.

## License

This icon is designed specifically for OwnExcaliDesk and is part of the project's assets.
