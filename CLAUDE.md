# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Autosys Job Explorer is a three-tier enterprise application for exploring and managing Autosys job information:
- **Backend** (`backend/rectrace`): Spring Boot 2.7.16 REST API with Elasticsearch and Oracle DB
- **Frontend** (`frontend/rectrace`): Angular 16 SPA with AG-Grid Enterprise
- **TLM Stats Service** (`rectrace-tlm-stats`): Standalone Spring Boot service for TLM statistics

## Essential Commands

### Backend Development
```bash
cd backend/rectrace

# Build and package
mvn clean install

# Run application
mvn spring-boot:run

# Run without tests (tests are currently skipped by default)
mvn clean install -DskipTests

# Application runs on http://localhost:6088
```

### Frontend Development
```bash
cd frontend/rectrace

# Install dependencies
npm install

# Development server (http://localhost:4200)
npm start

# Production build
npm run build

# Run tests
npm test
```

### TLM Stats Service
```bash
cd rectrace-tlm-stats

# Build and run
mvn clean install
mvn spring-boot:run

# Service runs on http://localhost:8080
```

## Architecture and Key Patterns

### Backend Architecture
- **Search Configuration**: Dynamic JSON-based search categories in `src/main/resources/search-config.json`
- **Multi-Provider Search**: Supports both Elasticsearch and Oracle queries through provider interfaces
- **API Structure**: 
  - `/api/v3/search/*` - Main search endpoints with SSRM support
  - `/api/execution-order/*` - Job dependency visualization
  - `/api/user/*` - User management
- **Key Services**: 
  - `SearchServiceV3` - Orchestrates search across providers
  - `ExecutionOrderService` - Manages job dependencies
  - `SearchConfigServiceV3` - Handles dynamic search configuration

### Frontend Architecture
- **State Management**: Service-based state management using RxJS
- **Grid Integration**: AG-Grid Enterprise with server-side row model
- **Custom Components**:
  - Cell renderers in `custom-interactions/components/renderers/`
  - Modal dialogs for execution order and TLM stats
- **Search Flow**: SearchComponent → SearchService → Backend API → Grid Display

### Database Connections
- Backend uses Oracle with configurable Elasticsearch
- TLM Stats connects to multiple Oracle instances (configured in `tlm-instances.json`)
- Password retrieval via external scripts for security

## Development Notes

### Testing
- Backend: Maven tests are skipped by default (`maven.test.skip=true`)
- Frontend: Karma/Jasmine tests available via `npm test`

### Key Configuration Files
- Backend: `application.properties`, `search-config.json`
- Frontend: `environment.ts`, `environment.prod.ts`
- TLM Stats: `application.properties`, `tlm-instances.json`

### Common Tasks
- **Add new search category**: Update `search-config.json` with category definition
- **Add custom grid renderer**: Create component in `custom-interactions/components/renderers/`
- **Modify API endpoints**: Update controllers in backend and corresponding services in frontend

### Important Patterns
- All APIs expect `x-citiportal-loginid` header for user context
- Search results use AG-Grid's server-side row model for performance
- Execution order visualization uses Cytoscape.js with dagre layout
- Error responses follow standardized format with status, error_type, and message