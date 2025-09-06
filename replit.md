# Overview

This repository contains two main projects: a **Discord Bot** (MiniPotato Bot) and a **Word Memory Game** web application. The Discord bot appears to be a feature-rich bot for Japanese communities with AI integration, RSS feeds, scheduling, and YouTube functionality. The Word Memory Game is a vocabulary learning application designed for students to practice word memorization through interactive flashcard sessions with progress tracking.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Discord Bot Architecture
- **Framework**: Node.js with Discord.js v14 for Discord API integration
- **AI Integration**: Google Generative AI (@google/genai) for intelligent responses
- **Database**: SQLite with Sequelize ORM for data persistence
- **External APIs**: YouTube integration via youtubei and @gonetone/get-youtube-id-by-url
- **RSS Processing**: RSS-parser for feed monitoring and notifications
- **Scheduling**: Node-cron for automated tasks and reminders
- **Web Server**: Express.js for health checks and web endpoints
- **Time Management**: Moment-timezone for Japanese timezone handling

The bot uses a modular architecture with separate command handlers and integrates multiple external services. It maintains user data, schedules, and vocabulary lists in SQLite database tables managed through Sequelize migrations.

## Word Memory Game Frontend Architecture
- **Framework**: React 18 with TypeScript and Vite build system
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack React Query for server state and caching
- **UI Framework**: Radix UI primitives with shadcn/ui component system
- **Styling**: Tailwind CSS with custom CSS variables for theming
- **Icons**: FontAwesome and Lucide React for consistent iconography

The frontend follows a component-based architecture with reusable UI components. The application flow includes file upload, range selection for vocabulary subsets, interactive study sessions with card flipping animations, and detailed progress tracking.

## Word Memory Game Backend Architecture
- **Framework**: Express.js with TypeScript
- **Database Integration**: Drizzle ORM configured for PostgreSQL
- **Development Storage**: In-memory storage implementation for local development
- **Build System**: Vite with custom server integration for development
- **API Design**: RESTful endpoints for vocabulary management and study sessions

The backend implements a storage abstraction layer that allows switching between in-memory storage for development and PostgreSQL for production. The architecture supports session management, progress tracking, and vocabulary word management.

## Data Storage Solutions
- **Discord Bot**: SQLite database with Sequelize ORM for local data persistence
- **Word Memory Game**: PostgreSQL with Drizzle ORM for production, in-memory storage for development
- **Schema Management**: Type-safe schemas using Drizzle and Zod validation
- **Migration Support**: Database migrations through Drizzle Kit and Sequelize CLI

The Discord bot stores user preferences, schedules, and vocabulary data in SQLite. The Word Memory Game uses a three-table schema: vocabulary_words, study_sessions, and word_progress for comprehensive learning analytics.

## Authentication and Authorization
- **Discord Bot**: Uses Discord OAuth through Discord.js client authentication
- **Word Memory Game**: No authentication system implemented - designed for single-user or demo purposes

The Discord bot authenticates through Discord's bot token system and manages permissions through Discord's built-in role and permission system.

# External Dependencies

## Discord Bot Services
- **Discord API**: Discord.js for bot functionality and guild management
- **Google AI**: Generative AI integration for intelligent responses
- **YouTube API**: Video information retrieval and processing
- **RSS Feeds**: Automated content monitoring and notifications

## Word Memory Game Services
- **Database**: PostgreSQL (configured for Neon serverless hosting)
- **Development Tools**: Replit integration with development banners and error handling
- **Build Tools**: Vite development server with hot reloading and TypeScript support

## Development Infrastructure
- **Package Management**: npm with lock files for dependency consistency
- **TypeScript**: Full type safety across both applications
- **Configuration**: Environment-based configuration for different deployment targets