# Overview

MiniPotato Bot is a Discord bot application with a web interface built using Node.js, Discord.js, and React. The bot appears to be designed for educational and productivity purposes, featuring schedule management and vocabulary learning capabilities. The application combines a Discord bot backend with a React-based web frontend for user interaction and management.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React 19 with TypeScript for type safety
- **Routing**: React Router DOM for client-side navigation
- **Build Tool**: Vite for fast development and optimized production builds
- **UI Structure**: Simple component-based architecture with pages for Home and Test functionality

## Backend Architecture
- **Runtime**: Node.js 20.x with ES modules
- **Main Framework**: Discord.js v14 for Discord bot functionality
- **Web Server**: Express.js for serving the web interface and API endpoints
- **Language**: TypeScript compiled to JavaScript modules
- **Execution**: TSX for TypeScript execution in development

## Data Storage Solutions
- **Database**: Sequelize ORM with SQLite3 as the database engine
- **Schema Management**: Sequelize CLI for database migrations and management
- **Data Files**: JSON files for sample data (schedules and word lists) stored in the commands/samples directory

## Bot Features
- **Schedule Management**: JSON-based schedule tracking with date, time, and task information
- **Vocabulary Learning**: Word list functionality with English words and Japanese meanings
- **Cron Jobs**: Node-cron for scheduled tasks and automated functionality
- **RSS Parsing**: RSS parser for content aggregation
- **YouTube Integration**: YouTube ID extraction and YouTubeI library for video-related features

## Development and Deployment
- **Build Process**: Vite builds the frontend, then Node.js serves the application
- **Development Workflow**: Combined build and start process for development
- **Module System**: ES modules throughout the application
- **Type Checking**: TypeScript with strict configuration for better code quality

# External Dependencies

## Core Bot Framework
- **Discord.js**: Primary Discord bot API wrapper for bot functionality
- **Node-cron**: Task scheduling for automated bot operations

## AI and Content Services
- **Google GenAI**: Google's Generative AI integration for intelligent bot responses
- **RSS Parser**: Content aggregation from RSS feeds
- **YouTube Integration**: 
  - `@gonetone/get-youtube-id-by-url`: YouTube URL parsing
  - `youtubei`: YouTube API interactions

## Database and ORM
- **Sequelize**: Object-relational mapping for database operations
- **SQLite3**: Lightweight database for data persistence
- **Sequelize CLI**: Database migration and management tools

## Web Technologies
- **Express.js**: Web server for serving the React application and API endpoints
- **Axios**: HTTP client for external API calls
- **Moment.js Timezone**: Date and time manipulation with timezone support

## Frontend Dependencies
- **React 19**: Latest React version for the web interface
- **React Router DOM**: Client-side routing for the web application
- **Vite**: Modern build tool and development server
- **TypeScript**: Type safety across the entire application stack

## Development Tools
- **TSX**: TypeScript execution for development
- **Various @types packages**: TypeScript definitions for libraries
- **Vite React Plugin**: React support for Vite build system