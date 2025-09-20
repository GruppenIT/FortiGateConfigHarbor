# Overview

ConfigHarbor is a comprehensive FortiGate configuration management system designed for on-premise deployment. The system provides automated ingestion, parsing, and analysis of FortiOS configuration backups with compliance monitoring capabilities. Built as a modern full-stack web application, it features a React frontend with shadcn/ui components and an Express.js backend with PostgreSQL database storage.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React with TypeScript using Vite as the build tool
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with custom design tokens and CSS variables
- **State Management**: TanStack Query for server state management
- **Routing**: Wouter for lightweight client-side routing
- **Authentication**: Context-based authentication with protected routes

## Backend Architecture
- **Framework**: Express.js with TypeScript
- **Database ORM**: Drizzle ORM for type-safe database operations
- **Authentication**: Passport.js with local strategy using scrypt for password hashing
- **Session Management**: Express sessions with PostgreSQL store
- **File Processing**: Automated ingestion service with configurable scheduling
- **API Design**: RESTful endpoints with role-based access control

## Data Storage Solutions
- **Primary Database**: PostgreSQL with Neon serverless configuration
- **Schema Management**: Drizzle Kit for migrations and schema evolution
- **File Storage**: Local filesystem with organized archival structure
- **Session Storage**: PostgreSQL-backed session store for scalability

## Authentication and Authorization
- **User Management**: Local user accounts with role-based permissions (admin, auditor, readonly)
- **Password Security**: Scrypt-based password hashing with salt
- **Session Security**: Secure session management with configurable secrets
- **Access Control**: Route-level protection with role-based feature access

## Configuration Processing Pipeline
- **File Ingestion**: Automated monitoring of `/data` directory with 5-minute intervals
- **Parser Architecture**: Modular FortiOS configuration parsers for different sections (firewall policies, system interfaces, admin users)
- **Serial Number Extraction**: Multi-strategy approach for device identification
- **Error Handling**: Quarantine system for unparseable configurations
- **Audit Trail**: Complete file processing history with archive organization

## Compliance Engine
- **Rule Definition**: YAML-based DSL for compliance rule specification
- **Automated Checking**: Scheduled compliance validation across all devices
- **Evidence Collection**: Detailed compliance evidence with JSON storage
- **Violation Tracking**: Historical compliance status with severity classification

# External Dependencies

## Database Services
- **Neon Database**: Serverless PostgreSQL hosting with connection pooling
- **WebSocket Support**: Real-time database connections via ws library

## UI Component Libraries
- **Radix UI**: Comprehensive set of accessible component primitives
- **Lucide React**: Icon library for consistent iconography
- **Embla Carousel**: Touch-friendly carousel component
- **React Hook Form**: Form validation and state management

## Development Tools
- **Vite**: Fast build tool with hot module replacement
- **ESBuild**: Bundle optimization for production builds
- **TypeScript**: Static type checking across the entire codebase
- **Tailwind CSS**: Utility-first CSS framework

## Authentication Dependencies
- **Passport.js**: Authentication middleware for Express
- **Connect PG Simple**: PostgreSQL session store adapter
- **Node.js Crypto**: Built-in cryptographic functions for password security

## File Processing
- **Node.js File System**: Native file operations for ingestion pipeline
- **YAML Parser**: Configuration rule parsing for compliance engine
- **Path utilities**: File organization and archive management