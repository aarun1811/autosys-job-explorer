# Rectrace TLM Stats

A Spring Boot application for TLM (Telemetry) statistics processing that provides REST APIs to query reconciliation statistics from multiple database instances.

## Technology Stack

- **Spring Boot**: 2.7.16
- **Java**: 8
- **Maven**: Build tool
- **Spring Web**: RESTful web services
- **Spring Data JPA**: Database connectivity
- **Oracle JDBC**: Database driver
- **Spring Actuator**: Application monitoring and metrics

## Features

- **Multi-Database Support**: Connects to 9 different TLM database instances
- **Reconmgmt Database**: Separate database for manual match statistics
- **Three Core APIs**: Break Stats, Automatch Stats, and Manual Match Stats
- **Parameter Validation**: Comprehensive input validation
- **Error Handling**: Standardized error responses
- **Logging**: Detailed logging for debugging and monitoring

## Prerequisites

- Java 8 or higher
- Maven 3.6 or higher
- Oracle Database access (for TLM instances and reconmgmt)
- Network access to database servers

## Getting Started

### 1. Database Configuration

#### TLM Database Instances
Update the TLM instance configurations in `src/main/resources/tlm-instances.json`:

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
Update the reconmgmt database configuration in `src/main/resources/application.properties`:

```properties
reconmgmt.datasource.url=jdbc:oracle:thin:@//reconmgmt-host:1521/reconmgmt
reconmgmt.datasource.username=reconmgmt_user
reconmgmt.datasource.service-name=reconmgmt_service
reconmgmt.datasource.db-schema=reconmgmt_schema
reconmgmt.datasource.driver-class-name=oracle.jdbc.OracleDriver
```

#### Password Script Configuration
The application uses a script to retrieve database passwords. Configure the script path:

```properties
password.script.path=/opt/rectify/control/scripts/get_password.sh
```

### 2. Build and Run

```bash
# Clone the repository
git clone <repository-url>
cd rectrace-tlm-stats

# Build the project
mvn clean install

# Run the application
mvn spring-boot:run
```

The application will start on `http://localhost:8080`

## API Documentation

### Base URL
```
http://localhost:8080/api/tlm-stats
```

### 1. Break Stats API

**Endpoint:** `GET /api/tlm-stats/breaks`

**Description:** Retrieves reconciliation break statistics from TLM database instances.

**Parameters:**
- `tlm_instance` (required): TLM instance identifier (e.g., "TLM1", "TLM2", etc.)
- `local_acc_no` (optional): Local account number filter
- `agent_code` (optional): Agent code filter

**Note:** Either `local_acc_no` or `agent_code` must be provided.

**Example Request:**
```
GET /api/tlm-stats/breaks?tlm_instance=TLM1&local_acc_no=IE6-HKD-4001928029-CITIBANK HONG KONG HKD
```

**Example Response:**
```json
{
  "status": "success",
  "tlm_instance": "TLM1",
  "data": [
    {
      "count": 5,
      "agent_code": "AGENT001",
      "local_acc_no": "IE6-HKD-4001928029-CITIBANK HONG KONG HKD",
      "bran_code": "BRANCH001"
    }
  ],
  "count": 1
}
```

### 2. Automatch Stats API

**Endpoint:** `GET /api/tlm-stats/automatch`

**Description:** Retrieves automatic matching statistics from TLM database instances.

**Parameters:**
- `tlm_instance` (required): TLM instance identifier
- `local_acc_no` (optional): Local account number filter
- `agent_code` (optional): Agent code filter

**Note:** Either `local_acc_no` or `agent_code` must be provided.

**Example Request:**
```
GET /api/tlm-stats/automatch?tlm_instance=TLM1&agent_code=AGENT001
```

**Example Response:**
```json
{
  "status": "success",
  "tlm_instance": "TLM1",
  "data": [
    {
      "tlm_instance": "TLM1",
      "agent_code": "AGENT001",
      "setid": "IE6-USD-4001843066-CITIBANK N.A NEW YORK USD",
      "stmt_date": "2024-01-15",
      "bran_code": "BRANCH001",
      "corr_acc_no": "CORR001",
      "total_items": 100,
      "automatch_items": 85,
      "outstanding_items": 15
    }
  ],
  "count": 1
}
```

### 3. Manual Match Stats API

**Endpoint:** `GET /api/tlm-stats/manual-match`

**Description:** Retrieves manual matching statistics from the reconmgmt database.

**Parameters:**
- `set_id` (optional): Set ID filter
- `agent_code` (optional): Agent code filter
- `tlm_instance` (optional): TLM instance filter

**Note:** Either `set_id` or `agent_code` must be provided.

**Example Request:**
```
GET /api/tlm-stats/manual-match?set_id=140144053 CTSM COMPEN&agent_code=AGENT001
```

**Example Response:**
```json
{
  "status": "success",
  "data": [
    {
      "tlm_instance": "TLM1",
      "agent_code": "AGENT001",
      "setid": "140144053 CTSM COMPEN",
      "stmt_date": "2024-01-15",
      "bran_code": "BRANCH001",
      "corr_acc_no": "CORR001",
      "total_manual_match_count": 10
    }
  ],
  "count": 1
}
```

### 4. Health Check API

**Endpoint:** `GET /api/tlm-stats/health`

**Description:** Health check endpoint for the TLM Stats service.

**Example Response:**
```json
{
  "status": "healthy",
  "service": "TLM Stats API",
  "timestamp": 1705123456789
}
```

## Error Responses

All APIs return standardized error responses:

```json
{
  "status": "error",
  "error_type": "validation_error",
  "message": "TLM instance is mandatory",
  "timestamp": 1705123456789
}
```

**Error Types:**
- `validation_error`: Invalid parameters or missing required fields
- `internal_error`: Server-side errors

## Project Structure

```
src/
├── main/
│   ├── java/
│   │   └── com/citi/gru/rectrace/tlmstats/
│   │       ├── TlmStatsApplication.java
│   │       ├── config/
│   │       │   └── DatabaseConfig.java
│   │       ├── controller/
│   │       │   ├── HealthController.java
│   │       │   └── TlmStatsController.java
│   │       ├── model/
│   │       │   ├── AutomatchStats.java
│   │       │   ├── BreakStats.java
│   │       │   ├── ManualMatchStats.java
│   │       │   ├── TlmInstanceConfig.java
│   │       │   └── TlmInstancesWrapper.java
│   │       ├── service/
│   │       │   └── TlmStatsService.java
│   │       └── util/
│   │           └── ScriptExecutor.java
│   └── resources/
│       ├── application.properties
│       └── tlm-instances.json
└── test/
    └── java/
        └── com/citi/gru/rectrace/tlmstats/
            └── TlmStatsApplicationTests.java
```

## Configuration

### Database Connection Pool
The application uses HikariCP for connection pooling. Configure in `application.properties`:

```properties
spring.datasource.hikari.maximum-pool-size=10
spring.datasource.hikari.minimum-idle=5
spring.datasource.hikari.connection-timeout=30000
```

### Logging
Configure logging levels in `application.properties`:

```properties
logging.level.com.rectrace.tlmstats=INFO
logging.level.org.springframework.web=INFO
logging.level.org.springframework.jdbc=DEBUG
```

## Development

### Adding New TLM Instances
1. Update `TlmInstanceConfig.java` with new instance details
2. Ensure the instance is accessible from the application server
3. Test connectivity using the health check endpoint

### Extending APIs
1. Add new model classes in the `model` package
2. Create corresponding service methods in `TlmStatsService`
3. Add controller endpoints in `TlmStatsController`
4. Update documentation

## Monitoring

The application includes Spring Actuator endpoints for monitoring:

- **Health Check**: `GET /actuator/health`
- **Application Info**: `GET /actuator/info`

## Security

**Note:** This application currently has no authentication or security implemented. For production use, consider adding:

- Spring Security for authentication
- API key validation
- HTTPS/TLS encryption
- Input sanitization
- Rate limiting

## Troubleshooting

### Common Issues

1. **Database Connection Errors**
   - Verify database credentials in configuration
   - Check network connectivity to database servers
   - Ensure Oracle JDBC driver is available

2. **TLM Instance Not Found**
   - Verify TLM instance name in request matches configuration
   - Check `TlmInstanceConfig.java` for correct instance names

3. **Query Timeout**
   - Adjust connection pool settings
   - Optimize database queries
   - Check database performance

### Logs
Check application logs for detailed error information:
```bash
tail -f logs/application.log
``` 