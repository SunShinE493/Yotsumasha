# Overview

This is a vocabulary learning application built as a full-stack web application. The system allows users to upload vocabulary word lists in JSON format and practice them through interactive study sessions. The application features a flashcard-style interface where users can test their knowledge of words and track their progress over time.

The application is designed for language learners who want to systematically study vocabulary with features like range selection, different ordering options, and progress tracking. It provides a clean, modern interface with responsive design and includes review functionality to help users focus on words they haven't mastered.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React with TypeScript using Vite as the build tool
- **Routing**: Wouter for client-side routing
- **State Management**: TanStack Query (React Query) for server state management
- **UI Components**: Radix UI primitives with shadcn/ui component library
- **Styling**: Tailwind CSS with CSS custom properties for theming
- **Form Handling**: React Hook Form with Zod validation resolvers

The frontend follows a component-based architecture with reusable UI components. The main application flow includes file upload, range selection, study sessions, and results viewing. Components are organized into feature-specific modules (file-upload, study-session, etc.) with shared UI components in a separate directory.

## Backend Architecture
- **Framework**: Express.js with TypeScript
- **API Design**: RESTful API endpoints for vocabulary management and study sessions
- **Database Integration**: Configured for PostgreSQL with Drizzle ORM
- **Development Storage**: In-memory storage implementation for development
- **Build System**: ESBuild for production bundling
- **Development**: TSX for hot reloading during development

The backend implements a storage abstraction layer that allows switching between different storage implementations. Currently includes an in-memory storage for development and is structured to easily integrate with a PostgreSQL database using Drizzle ORM.

## Data Storage Solutions
- **ORM**: Drizzle ORM with PostgreSQL dialect configured
- **Schema Management**: Type-safe database schemas with Zod validation
- **Migration Support**: Drizzle Kit for database migrations
- **Database Provider**: Configured for Neon serverless PostgreSQL
- **Session Storage**: PostgreSQL session store for production

The database schema includes three main entities: vocabulary words, study sessions, and word progress tracking. The schema supports features like word categorization, difficulty levels, and detailed progress tracking.

## Authentication and Authorization
The current implementation does not include authentication or authorization mechanisms. The application appears to be designed for single-user or demonstration purposes. Session management is configured but not actively used for user authentication.

# External Dependencies

## Database Services
- **Neon Database**: Serverless PostgreSQL database hosting
- **Connection**: Uses connection pooling through @neondatabase/serverless

## UI and Design Libraries
- **Radix UI**: Comprehensive set of low-level UI primitives for accessibility
- **Tailwind CSS**: Utility-first CSS framework for styling
- **Lucide React**: Icon library for consistent iconography
- **Font Integration**: Google Fonts (Inter, DM Sans, Fira Code, Geist Mono, Architects Daughter)

## Development Tools
- **Vite**: Fast build tool and development server
- **TypeScript**: Type safety and enhanced developer experience
- **ESBuild**: Fast JavaScript bundler for production builds
- **PostCSS**: CSS processing with Autoprefixer

## Form and Validation
- **React Hook Form**: Performant form library with minimal re-renders
- **Zod**: TypeScript-first schema validation library
- **Hookform Resolvers**: Integration between React Hook Form and Zod

## State Management and Data Fetching
- **TanStack Query**: Server state management with caching and synchronization
- **Local Storage**: Client-side progress tracking fallback

The application is structured to be easily deployable on platforms like Replit, with specific configurations for development and production environments. The modular architecture allows for easy extension and modification of features.