# Autosys Job Explorer

A comprehensive system for exploring and managing Autosys job information through multiple search interfaces. The repository consists of three main components: a backend search service, a frontend Angular application, and a standalone TLM statistics service.

## 🏗️ Architecture Overview

The system is composed of three independent but integrated applications:

- **Backend** (`backend/rectrace`): Spring Boot REST API for job search and data retrieval
- **Frontend** (`frontend/rectrace`): Angular web application providing the user interface
- **TLM Stats Service** (`rectrace-tlm-stats`): Standalone Spring Boot service for TLM statistics

## 📋 Table of Contents

- [System Overview](#system-overview)
- [Backend Application](#backend-application)
- [Frontend Application](#frontend-application)
- [TLM Stats Service](#tlm-stats-service)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [API Documentation](#api-documentation)
- [Deployment](#deployment)
- [Contributing](#contributing)

## 🔍 System Overview

### Core Features

- **Multi-Category Search**: Search across various job attributes including file names, job names, box names, set IDs, and more
- **Advanced Grid Interface**: Enterprise-grade data grid with sorting, filtering, and grouping capabilities
- **Execution Order Visualization**: Interactive graphs showing job execution dependencies
- **TLM Statistics**: Comprehensive reconciliation statistics from multiple TLM instances
- **Real-time Search Suggestions**: Autocomplete functionality with intelligent suggestions
- **User Management**: User authentication and session management

### Technology Stack

- **Backend**: Spring Boot 2.7.16, Java 8, Oracle Database, Elasticsearch
- **Frontend**: Angular 16, Material Design, AG-Grid Enterprise, Cytoscape.js
- **TLM Stats**: Spring Boot 2.7.16, Java 8, Oracle Database (Multiple instances)

---

## 🔧 Backend Application

### Overview

The backend service (`backend/rectrace`) is a Spring Boot application that provides REST APIs for job exploration and search functionality. It supports multiple search providers including Elasticsearch and Oracle Database.

### Technology Stack

- **Spring Boot**: 2.7.16
- **Java**: 8
- **Maven**: Build tool
- **Spring Data JPA**: Database connectivity
- **Spring Data Elasticsearch**: Search functionality
- **Oracle JDBC**: Database driver
- **Apache POI**: Excel file processing

### Key Features

- **Multi-Provider Search**: Supports both Elasticsearch and Oracle Database queries
- **Dynamic Search Configuration**: JSON-based search category definitions
- **Execution Order Tracking**: Job dependency visualization data
- **Suggestion Engine**: Intelligent search term suggestions
- **CORS Support**: Cross-origin resource sharing for frontend integration

### API Endpoints

#### Search APIs
- `GET /api/v3/search/keyword` - Keyword-based search across categories
- `GET /api/v3/search/expand` - Expand search results for specific groups
- `POST /api/v3/search/ssrm/{category}` - Server-side row model for AG-Grid
- `GET /api/search/suggest` - Get search suggestions

#### User Management
- `GET /api/user/info` - Get current user information

#### Execution Order
- `GET /api/execution-order/{loadJobName}` - Get execution order for a specific job

### Database Configuration

The application connects to:
- **Oracle Database**: Primary data source for job information
- **Elasticsearch**: Search index for fast text-based queries

```properties
# Oracle Database
spring.datasource.url=jdbc:oracle:thin:@host:port/service
spring.datasource.username=username
spring.datasource.password=password

# Elasticsearch
spring.elasticsearch.uris=https://localhost:9200
spring.elasticsearch.username=username
spring.elasticsearch.password=password
```

### Search Categories

The system supports 13 different search categories:
1. **File Name**: Search by file name patterns
2. **Recon Name**: Search by reconciliation names
3. **Box Name**: Search by Autosys box names
4. **Set ID**: Search by set identifiers
5. **Sub Account**: Search by sub-account information
6. **Load File Name**: Search by load file patterns
7. **Job Name**: Search by Autosys job names
8. **Machine Name**: Search by machine identifiers
9. **Run Calendar**: Search by run calendar names
10. **Exclude Calendar**: Search by exclude calendar names
11. **TLM Instance**: Search by TLM instance names
12. **Recon ID**: Search by reconciliation IDs
13. **Recon Portal ID**: Search by reconciliation portal IDs

### Building and Running

```bash
# Navigate to backend directory
cd backend/rectrace

# Build the project
mvn clean install

# Run the application
mvn spring-boot:run

# Or run the JAR file
java -jar target/rectrace-0.0.1-SNAPSHOT.jar
```

The backend service will start on `http://localhost:6088`

---

## 🎨 Frontend Application

### Overview

The frontend application (`frontend/rectrace`) is an Angular 16 application that provides a modern, responsive user interface for the Autosys Job Explorer system.

### Technology Stack

- **Angular**: 16.2.0
- **Angular Material**: 16.2.14 (Material Design components)
- **AG-Grid Enterprise**: 32.2.2 (Advanced data grid)
- **Cytoscape.js**: 3.31.1 (Graph visualization)
- **TypeScript**: 5.1.3
- **RxJS**: 7.8.0 (Reactive programming)

### Key Features

- **Intelligent Search Interface**: Real-time search with autocomplete suggestions
- **Advanced Data Grid**: Enterprise-grade grid with server-side row model (SSRM)
- **Interactive Visualizations**: Execution order graphs using Cytoscape.js
- **Responsive Design**: Mobile-friendly Material Design interface
- **Real-time Updates**: Reactive data updates using RxJS
- **State Management**: Comprehensive state management for search and grid operations

### Application Structure

```
src/app/
├── core/                          # Core functionality and shared services
├── custom-interactions/           # Custom grid renderers and modals
│   ├── components/
│   │   ├── modals/               # Modal dialogs (execution order, TLM stats)
│   │   └── renderers/            # Custom AG-Grid cell renderers
├── models/                       # TypeScript interfaces and models
├── search-feature/               # Main search functionality
│   ├── components/
│   │   ├── search/              # Main search component
│   │   └── all-jobs/            # AG-Grid jobs display component
│   └── services/                # Search-related services
├── services/                     # Application-wide services
└── types/                       # Type definitions
```

### Key Components

#### Search Component
- Main search interface with autocomplete functionality
- Tab-based results display
- Real-time search suggestions
- User state management

#### All Jobs Component
- Advanced AG-Grid configuration
- Server-side row model for large datasets
- Custom cell renderers for specific data types
- Column management and state persistence

#### Custom Renderers
- **App ID Cell Renderer**: Clickable application ID links
- **Support Email Renderer**: Mailto links for support contacts
- **Execution Order Button**: Interactive execution order visualization trigger
- **Recon Cell Renderer**: Reconciliation-specific formatting
- **Set ID Cell Renderer**: Set ID formatting and interactions

### Services Architecture

#### Search Input Service
- Manages search input state and suggestions
- Placeholder text rotation
- Debounced search suggestions

#### Search State Service
- Centralized state management for search operations
- Loading states and error handling
- Search result caching

#### Search Results Service
- Manages search results and grid state
- Column visibility and deduplication
- Category-specific result handling

#### Grid Services
- **Grid Configuration Service**: AG-Grid setup and configuration
- **Grid Actions Service**: Grid interaction handlers
- **Grid State Service**: Grid state persistence and management

### Environment Configuration

```typescript
// Development
export const environment = {
  production: false,
  apiUrl: 'http://localhost:6088/api',
  tlmStatsUrl: 'http://localhost:8080/api/tlm-stats',
  agGridLicenseKey: 'License_Value'
};

// Production
export const environment = {
  production: true,
  apiUrl: '/api',
  tlmStatsUrl: '/api/tlm-stats',
  agGridLicenseKey: 'License_Value'
};
```

### Building and Running

```bash
# Navigate to frontend directory
cd frontend/rectrace

# Install dependencies
npm install

# Start development server
npm start

# Build for production
npm run build

# Run tests
npm test
```

The frontend application will start on `http://localhost:4200`

---

## 📊 TLM Stats Service

### Overview

The TLM Stats service (`rectrace-tlm-stats`) is a standalone Spring Boot application that provides REST APIs for querying reconciliation statistics from multiple TLM database instances.

### Technology Stack

- **Spring Boot**: 2.7.16
- **Java**: 8
- **Maven**: Build tool
- **Spring Data JPA**: Database connectivity
- **Oracle JDBC**: Database driver
- **Spring Actuator**: Health monitoring

### Key Features

- **Multi-Database Support**: Connects to 9 different TLM database instances
- **Reconmgmt Database Integration**: Separate database for manual match statistics
- **Three Core APIs**: Break Stats, Automatch Stats, and Manual Match Stats
- **Parameter Validation**: Comprehensive input validation
- **Health Monitoring**: Built-in health check endpoints
- **Script-based Authentication**: Secure password retrieval via external scripts

### API Endpoints

#### Break Stats API
```
GET /api/tlm-stats/breaks?tlm_instance=TLM1&local_acc_no=account_number
```
Retrieves reconciliation break statistics from TLM database instances.

#### Automatch Stats API
```
GET /api/tlm-stats/automatch?tlm_instance=TLM1&agent_code=AGENT001
```
Retrieves automatic matching statistics from TLM database instances.

#### Manual Match Stats API
```
GET /api/tlm-stats/manual-match?set_id=140144053&agent_code=AGENT001
```
Retrieves manual matching statistics from the reconmgmt database.

#### Health Check API
```
GET /api/tlm-stats/health
```
Health check endpoint for service monitoring.

### Database Configuration

#### TLM Instances
Configure TLM instances in `src/main/resources/tlm-instances.json`:

```json
{
  "tlmInstances": [
    {
      "instanceName": "TLM1",
      "host": "tlm1-host",
      "port": "1521",
      "serviceName": "tlm1_service",
      "username": "tlm1_user",
      "dbSchema": "tlm1_schema"
    }
  ]
}
```

#### Reconmgmt Database
Configure in `src/main/resources/application.properties`:

```properties
reconmgmt.datasource.url=jdbc:oracle:thin:@//host:1521/service
reconmgmt.datasource.username=username
reconmgmt.datasource.service-name=service
reconmgmt.datasource.db-schema=schema
```

### Building and Running

```bash
# Navigate to TLM stats directory
cd rectrace-tlm-stats

# Build the project
mvn clean install

# Run the application
mvn spring-boot:run
```

The TLM Stats service will start on `http://localhost:8080`

---

## 🚀 Getting Started

### Prerequisites

- **Java 8** or higher
- **Maven 3.6** or higher
- **Node.js 16** or higher
- **npm 8** or higher
- **Oracle Database** access
- **Elasticsearch** (optional, for search functionality)

### Quick Start

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd autosys-job-explorer
   ```

2. **Start the TLM Stats Service**
   ```bash
   cd rectrace-tlm-stats
   mvn spring-boot:run
   ```

3. **Start the Backend Service**
   ```bash
   cd backend/rectrace
   mvn spring-boot:run
   ```

4. **Start the Frontend Application**
   ```bash
   cd frontend/rectrace
   npm install
   npm start
   ```

5. **Access the Application**
   - Frontend: `http://localhost:4200`
   - Backend API: `http://localhost:6088`
   - TLM Stats API: `http://localhost:8080`

---

## 💻 Development Setup

### Database Setup

1. **Configure Oracle Database connections** in each service's application properties
2. **Set up Elasticsearch** (if using search functionality)
3. **Configure password scripts** for secure authentication

### IDE Configuration

- **Java Development**: IntelliJ IDEA or Eclipse with Spring Boot plugins
- **Frontend Development**: VSCode with Angular Language Service
- **Database**: Oracle SQL Developer or similar tool

### Code Style

- **Backend**: Follow Spring Boot best practices and Google Java Style Guide
- **Frontend**: Follow Angular Style Guide and use TSLint/ESLint

---

## 📚 API Documentation

### Authentication

All APIs expect user authentication via the `x-citiportal-loginid` header:

```http
x-citiportal-loginid: user.name@company.com
```

### Response Format

All APIs return standardized JSON responses:

**Success Response:**
```json
{
  "status": "success",
  "data": [...],
  "count": 10,
  "tlm_instance": "TLM1"
}
```

**Error Response:**
```json
{
  "status": "error",
  "error_type": "validation_error",
  "message": "Error description",
  "timestamp": 1705123456789
}
```

---

## 🤝 Contributing

### Development Workflow

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Make your changes** following the code style guidelines
4. **Test thoroughly** including unit and integration tests
5. **Commit your changes**: `git commit -m 'Add amazing feature'`
6. **Push to the branch**: `git push origin feature/amazing-feature`
7. **Open a Pull Request**

### Code Quality

- **Backend**: Follow Spring Boot best practices
- **Frontend**: Follow Angular best practices
- **Documentation**: Update documentation for any API changes
- **Performance**: Consider performance impact of changes

---

## 📝 License

This project is proprietary software owned by Citi GRU. All rights reserved.

---

## 🔄 Version History

### Current Version: 0.0.1-SNAPSHOT

#### Features
- Multi-category job search functionality
- Advanced grid interface with AG-Grid Enterprise
- Execution order visualization
- TLM statistics APIs
- User authentication integration

#### Known Issues
- No comprehensive security implementation
- Limited error handling in some edge cases
- Performance optimization needed for large datasets

---

*This README provides comprehensive documentation for the Autosys Job Explorer system. For specific technical details, refer to the individual service documentation and code comments.*