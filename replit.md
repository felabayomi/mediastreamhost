# MediaHost Pro - Media Management Platform

## Overview

MediaHost Pro is a comprehensive media management platform built with Express.js, React, and PostgreSQL. It provides robust file upload, storage, transformation, and sharing capabilities with access control and administrative features. The platform supports images and videos with real-time conversion, URL generation, and embeddable media serving.

## System Architecture

The application follows a modern full-stack architecture with clear separation between frontend and backend concerns:

- **Frontend**: React with TypeScript, utilizing Vite for development and build processes
- **Backend**: Express.js server with TypeScript, providing RESTful API endpoints
- **Database**: PostgreSQL with Drizzle ORM for type-safe database operations
- **UI Framework**: Tailwind CSS with shadcn/ui component library
- **State Management**: TanStack Query for server state management

## Key Components

### Database Layer (Drizzle ORM)
- **Schema**: Centralized schema definition in `shared/schema.ts`
- **Tables**: `media_files`, `conversions`, `users` with proper relationships
- **Migration Support**: Automated migrations with `drizzle-kit`

### Storage Service
- **File Persistence**: Base64-encoded file content storage in database
- **Media Serving**: Direct file serving via `/api/media/serve/:filename` endpoint
- **CORS Support**: Cross-origin resource sharing for external embedding
- **URL Generation**: Production-ready embeddable URLs with transformation parameters

### Authentication & Access Control
- **Access Code System**: Simple but secure access code authentication
- **Role-Based Access**: Admin, developer, and user roles with different permissions
- **Session Management**: Client-side session storage with server-side validation

### File Processing
- **Multi-format Support**: JPEG, PNG, GIF, WebP images; MP4, AVI, MOV videos
- **Image Transformations**: Width, height, fit modes, cropping, quality adjustments
- **Conversion Pipeline**: Asynchronous format conversion with progress tracking
- **Thumbnail Generation**: Automatic thumbnail creation for media files

### API Architecture
- **RESTful Endpoints**: Standard HTTP methods for CRUD operations
- **File Upload**: Multipart form data handling with size limits
- **Media Serving**: Direct binary content serving with proper MIME types
- **Search & Filtering**: Query-based media library filtering

## Data Flow

1. **Upload Process**: Files → Multer → Database Storage → URL Generation
2. **Media Serving**: URL Request → Database Lookup → Binary Response
3. **Conversion Flow**: Original File → Processing Queue → Converted Output
4. **Access Control**: Request → Code Validation → User Session → Resource Access

## External Dependencies

### Core Framework Dependencies
- **Express.js**: Web server framework
- **React**: Frontend UI library
- **TypeScript**: Type safety across the stack
- **Vite**: Development server and build tool

### Database & ORM
- **@neondatabase/serverless**: PostgreSQL connection for serverless environments
- **drizzle-orm**: Type-safe database operations
- **drizzle-kit**: Database migrations and schema management

### UI & Styling
- **Tailwind CSS**: Utility-first CSS framework
- **@radix-ui/**: Accessible component primitives
- **shadcn/ui**: Pre-built component library

### File Processing
- **multer**: File upload handling
- **sharp**: Image processing and transformations (to be integrated)

### Development Tools
- **tsx**: TypeScript execution for development
- **esbuild**: Fast JavaScript bundler for production

## Deployment Strategy

The application is configured for deployment on Replit with the following setup:

### Development Environment
- **Runtime**: Node.js 20 with PostgreSQL 16
- **Development Server**: `npm run dev` starts both frontend and backend
- **Hot Reload**: Vite HMR for frontend, tsx for backend development

### Production Build
- **Build Process**: Vite builds frontend, esbuild bundles backend
- **Output Structure**: Static assets in `dist/public`, server bundle in `dist/`
- **Environment Variables**: DATABASE_URL required for database connection

### Replit Configuration
- **Modules**: nodejs-20, web, postgresql-16
- **Port Configuration**: Internal port 5000, external port 80
- **Auto-scaling**: Configured for autoscale deployment target

### Database Setup
- **Schema Initialization**: Automated via Drizzle migrations
- **Admin User Creation**: Bootstrap script creates initial admin user
- **Connection Pooling**: Configured for serverless PostgreSQL connections

## Changelog

- June 26, 2025. Initial setup

## User Preferences

Preferred communication style: Simple, everyday language.