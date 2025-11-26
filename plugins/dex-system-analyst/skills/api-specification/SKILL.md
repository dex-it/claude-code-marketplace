---
name: api-specification
description: Activate when designing or documenting REST APIs, creating OpenAPI/Swagger specifications, or discussing API contracts. Contains best practices for API design in .NET.
allowed-tools: Read, Write, Edit, Grep
---

# API Specification Skill

This skill provides comprehensive knowledge about designing and documenting REST APIs using OpenAPI/Swagger specification for ASP.NET Core applications.

## What is OpenAPI?

OpenAPI Specification (formerly Swagger) is a standard, language-agnostic interface description for REST APIs. It allows both humans and computers to understand API capabilities without source code access.

**Key Benefits**:
- Contract-first API development
- Automatic documentation generation (Swagger UI)
- Client SDK generation
- API testing and validation
- Version control for API changes
- Team collaboration and communication

## OpenAPI 3.0 Structure

### Root Document Structure

```yaml
openapi: 3.0.3                    # OpenAPI version
info:                             # API metadata
  title: My API
  version: 1.0.0
  description: API description
  contact:
    name: Support
    email: support@example.com
  license:
    name: MIT

servers:                          # API server URLs
  - url: https://api.example.com/v1
    description: Production
  - url: http://localhost:5000/v1
    description: Development

tags:                             # Tag groupings
  - name: Users
    description: User operations

paths:                            # API endpoints
  /users:
    get: ...
    post: ...

components:                       # Reusable schemas
  schemas: ...
  responses: ...
  parameters: ...
  securitySchemes: ...

security:                         # Global security
  - bearerAuth: []
```

## Path and Operations

### Path Structure

```yaml
paths:
  /users:                         # Resource path
    get:                          # HTTP method
      summary: Get all users      # Short description
      description: |              # Detailed description
        Retrieve a paginated list of users.
        Supports filtering and sorting.
      operationId: getUsers       # Unique operation ID
      tags:                       # Categorization
        - Users
      parameters: ...             # Query/header params
      responses: ...              # Response definitions
      security: ...               # Auth requirements
      deprecated: false           # Deprecation status
```

### Parameters

#### Query Parameters
```yaml
parameters:
  - name: page
    in: query
    description: Page number (1-based)
    required: false
    schema:
      type: integer
      minimum: 1
      default: 1
      example: 1

  - name: pageSize
    in: query
    description: Items per page
    required: false
    schema:
      type: integer
      minimum: 1
      maximum: 100
      default: 20

  - name: search
    in: query
    description: Search term
    required: false
    schema:
      type: string
      maxLength: 100

  - name: sortBy
    in: query
    description: Sort field
    schema:
      type: string
      enum: [name, email, createdAt]
      default: createdAt

  - name: sortOrder
    in: query
    description: Sort direction
    schema:
      type: string
      enum: [asc, desc]
      default: desc
```

#### Path Parameters
```yaml
/users/{id}:
  parameters:
    - name: id
      in: path
      description: User ID
      required: true
      schema:
        type: integer
        format: int32
        example: 123
```

#### Header Parameters
```yaml
parameters:
  - name: X-API-Version
    in: header
    description: API version
    required: false
    schema:
      type: string
      example: "1.0"
```

### Request Body

```yaml
requestBody:
  description: User data
  required: true
  content:
    application/json:
      schema:
        $ref: '#/components/schemas/CreateUserRequest'
      examples:
        default:
          value:
            email: user@example.com
            firstName: John
            lastName: Doe
            password: SecureP@ss123
        minimal:
          value:
            email: user@example.com
            password: SecureP@ss123
```

### Responses

```yaml
responses:
  '200':
    description: Successful response
    headers:
      X-Rate-Limit:
        description: Requests per hour
        schema:
          type: integer
      X-Rate-Limit-Remaining:
        description: Requests remaining
        schema:
          type: integer
    content:
      application/json:
        schema:
          $ref: '#/components/schemas/UserResponse'
        examples:
          default:
            value:
              id: 1
              email: user@example.com
              firstName: John
              lastName: Doe

  '201':
    description: Created
    headers:
      Location:
        description: URL of created resource
        schema:
          type: string
          format: uri
          example: /api/users/123
    content:
      application/json:
        schema:
          $ref: '#/components/schemas/UserResponse'

  '400':
    $ref: '#/components/responses/BadRequest'

  '401':
    $ref: '#/components/responses/Unauthorized'

  '404':
    $ref: '#/components/responses/NotFound'

  '500':
    $ref: '#/components/responses/InternalError'
```

## Components (Reusable Elements)

### Schemas

#### Simple Schema
```yaml
components:
  schemas:
    UserId:
      type: integer
      format: int32
      minimum: 1
      example: 123
```

#### Object Schema
```yaml
UserResponse:
  type: object
  required:
    - id
    - email
    - firstName
    - lastName
  properties:
    id:
      type: integer
      format: int32
      description: Unique identifier
      example: 1
      readOnly: true
    email:
      type: string
      format: email
      description: Email address
      example: user@example.com
      maxLength: 255
    firstName:
      type: string
      description: First name
      example: John
      minLength: 1
      maxLength: 50
    lastName:
      type: string
      description: Last name
      example: Doe
      minLength: 1
      maxLength: 50
    isActive:
      type: boolean
      description: Account status
      example: true
      default: true
    createdAt:
      type: string
      format: date-time
      description: Creation timestamp
      example: '2025-01-01T00:00:00Z'
      readOnly: true
    updatedAt:
      type: string
      format: date-time
      description: Last update timestamp
      example: '2025-01-15T10:30:00Z'
      readOnly: true
```

#### Array Schema
```yaml
UserListResponse:
  type: object
  required:
    - items
    - totalCount
    - page
    - pageSize
  properties:
    items:
      type: array
      items:
        $ref: '#/components/schemas/UserResponse'
    totalCount:
      type: integer
      description: Total items across all pages
      example: 150
    page:
      type: integer
      description: Current page
      example: 1
    pageSize:
      type: integer
      description: Items per page
      example: 20
    hasMore:
      type: boolean
      description: More pages available
      example: true
```

#### Enum Schema
```yaml
UserRole:
  type: string
  enum:
    - Admin
    - Manager
    - User
    - Guest
  description: User role
  example: User
```

#### AllOf (Inheritance)
```yaml
# Base schema
BaseEntity:
  type: object
  required:
    - id
    - createdAt
  properties:
    id:
      type: integer
      format: int32
    createdAt:
      type: string
      format: date-time
    updatedAt:
      type: string
      format: date-time

# Derived schema
User:
  allOf:
    - $ref: '#/components/schemas/BaseEntity'
    - type: object
      required:
        - email
      properties:
        email:
          type: string
          format: email
        firstName:
          type: string
```

#### OneOf (Union)
```yaml
PaymentMethod:
  oneOf:
    - $ref: '#/components/schemas/CreditCardPayment'
    - $ref: '#/components/schemas/BankTransferPayment'
    - $ref: '#/components/schemas/PayPalPayment'
  discriminator:
    propertyName: type
    mapping:
      CreditCard: '#/components/schemas/CreditCardPayment'
      BankTransfer: '#/components/schemas/BankTransferPayment'
      PayPal: '#/components/schemas/PayPalPayment'
```

### Security Schemes

#### Bearer Token (JWT)
```yaml
components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
      description: |
        JWT token obtained from /auth/login endpoint.
        Include in Authorization header: Bearer <token>

# Apply globally
security:
  - bearerAuth: []

# Or per operation
paths:
  /users:
    get:
      security:
        - bearerAuth: []
```

#### API Key
```yaml
components:
  securitySchemes:
    apiKey:
      type: apiKey
      in: header
      name: X-API-Key
      description: API key for authentication
```

#### OAuth2
```yaml
components:
  securitySchemes:
    oauth2:
      type: oauth2
      flows:
        authorizationCode:
          authorizationUrl: https://auth.example.com/oauth/authorize
          tokenUrl: https://auth.example.com/oauth/token
          scopes:
            read:users: Read user information
            write:users: Modify user information
            admin: Administrative access
```

### Reusable Responses

```yaml
components:
  responses:
    BadRequest:
      description: Bad request - invalid input
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorResponse'
          example:
            error: VALIDATION_ERROR
            message: Invalid request parameters
            details:
              - field: email
                message: Email format is invalid

    Unauthorized:
      description: Unauthorized - authentication required
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorResponse'
          example:
            error: UNAUTHORIZED
            message: Authentication token is missing or invalid

    Forbidden:
      description: Forbidden - insufficient permissions
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorResponse'
          example:
            error: FORBIDDEN
            message: You don't have permission to perform this action

    NotFound:
      description: Resource not found
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorResponse'
          example:
            error: NOT_FOUND
            message: The requested resource was not found

    InternalError:
      description: Internal server error
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorResponse'
          example:
            error: INTERNAL_ERROR
            message: An unexpected error occurred
            traceId: 80000000-0000-0000-0000-000000000000
```

## REST API Design Principles

### 1. Resource Naming

**Use Nouns, Not Verbs**:
- Good: `GET /users`, `POST /orders`
- Bad: `GET /getUsers`, `POST /createOrder`

**Use Plural Nouns**:
- Good: `/users`, `/products`
- Bad: `/user`, `/product`

**Hierarchical Resources**:
```
/users/{userId}/orders              # User's orders
/users/{userId}/orders/{orderId}    # Specific order
/categories/{categoryId}/products   # Products in category
```

**Avoid Deep Nesting** (max 2-3 levels):
- Good: `/orders/{id}/items`
- Bad: `/users/{userId}/orders/{orderId}/items/{itemId}/reviews/{reviewId}`

### 2. HTTP Methods

| Method | Purpose | Idempotent | Safe |
|--------|---------|------------|------|
| GET | Retrieve resource(s) | Yes | Yes |
| POST | Create new resource | No | No |
| PUT | Replace entire resource | Yes | No |
| PATCH | Partial update | No | No |
| DELETE | Remove resource | Yes | No |

**Examples**:
```
GET    /users              # List all users
GET    /users/{id}         # Get specific user
POST   /users              # Create new user
PUT    /users/{id}         # Replace user completely
PATCH  /users/{id}         # Update user partially
DELETE /users/{id}         # Delete user
```

### 3. Status Codes

**Success (2xx)**:
- `200 OK`: Successful GET, PUT, PATCH, DELETE
- `201 Created`: Successful POST (include Location header)
- `204 No Content`: Successful DELETE with no response body

**Client Errors (4xx)**:
- `400 Bad Request`: Invalid request data
- `401 Unauthorized`: Authentication required
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Resource doesn't exist
- `409 Conflict`: Duplicate resource
- `422 Unprocessable Entity`: Validation failed

**Server Errors (5xx)**:
- `500 Internal Server Error`: Unexpected error
- `503 Service Unavailable`: Temporary unavailability

### 4. Pagination

**Page-Based**:
```
GET /users?page=1&pageSize=20

Response:
{
  "items": [...],
  "page": 1,
  "pageSize": 20,
  "totalCount": 150,
  "totalPages": 8
}
```

**Cursor-Based**:
```
GET /users?cursor=abc123&limit=20

Response:
{
  "items": [...],
  "nextCursor": "xyz789",
  "hasMore": true
}
```

### 5. Filtering & Sorting

**Filtering**:
```
GET /products?category=electronics&minPrice=100&maxPrice=500
GET /users?isActive=true&role=Admin
```

**Sorting**:
```
GET /users?sortBy=createdAt&sortOrder=desc
GET /products?sort=-price,name  # Descending price, then name
```

**Searching**:
```
GET /products?search=laptop
GET /users?q=john
```

### 6. Versioning

**URL Versioning** (recommended):
```
/api/v1/users
/api/v2/users
```

**Header Versioning**:
```
Accept: application/vnd.myapi.v1+json
X-API-Version: 1.0
```

**Query Parameter** (not recommended):
```
/api/users?version=1
```

### 7. Error Response Format

**Standardized Error Structure**:
```json
{
  "error": "VALIDATION_ERROR",
  "message": "Invalid request parameters",
  "details": [
    {
      "field": "email",
      "message": "Email format is invalid",
      "code": "INVALID_FORMAT"
    }
  ],
  "traceId": "80000000-0000-0000-0000-000000000000",
  "timestamp": "2025-01-26T10:30:00Z"
}
```

## ASP.NET Core Integration

### Configure Swagger

```csharp
// Program.cs or Startup.cs
services.AddSwaggerGen(options =>
{
    // API info
    options.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "My API",
        Version = "v1",
        Description = "API for managing users and orders",
        Contact = new OpenApiContact
        {
            Name = "API Support",
            Email = "support@example.com",
            Url = new Uri("https://example.com/support")
        },
        License = new OpenApiLicense
        {
            Name = "MIT",
            Url = new Uri("https://opensource.org/licenses/MIT")
        }
    });

    // Include XML comments
    var xmlFile = $"{Assembly.GetExecutingAssembly().GetName().Name}.xml";
    var xmlPath = Path.Combine(AppContext.BaseDirectory, xmlFile);
    options.IncludeXmlComments(xmlPath);

    // JWT authentication
    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Description = "JWT Authorization header using the Bearer scheme. Enter 'Bearer' [space] and then your token.",
        Name = "Authorization",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT"
    });

    options.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });

    // Custom schema IDs
    options.CustomSchemaIds(type => type.FullName);
});

// Enable Swagger UI
app.UseSwagger();
app.UseSwaggerUI(options =>
{
    options.SwaggerEndpoint("/swagger/v1/swagger.json", "My API V1");
    options.RoutePrefix = "api-docs";
    options.DocumentTitle = "My API Documentation";
});
```

### Controller with XML Comments

```csharp
/// <summary>
/// User management endpoints
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
public class UsersController : ControllerBase
{
    /// <summary>
    /// Get all users
    /// </summary>
    /// <param name="page">Page number (1-based)</param>
    /// <param name="pageSize">Number of items per page</param>
    /// <param name="search">Search term for filtering</param>
    /// <returns>Paginated list of users</returns>
    /// <response code="200">Returns the list of users</response>
    /// <response code="400">Invalid parameters</response>
    /// <response code="401">Unauthorized</response>
    [HttpGet]
    [ProducesResponseType(typeof(UserListResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<UserListResponse>> GetUsers(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? search = null,
        CancellationToken cancellationToken = default)
    {
        // Implementation
    }

    /// <summary>
    /// Get user by ID
    /// </summary>
    /// <param name="id">User ID</param>
    /// <returns>User details</returns>
    /// <response code="200">Returns the user</response>
    /// <response code="404">User not found</response>
    [HttpGet("{id}")]
    [ProducesResponseType(typeof(UserResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<UserResponse>> GetUserById(
        int id,
        CancellationToken cancellationToken)
    {
        // Implementation
    }

    /// <summary>
    /// Create new user
    /// </summary>
    /// <param name="request">User data</param>
    /// <returns>Created user</returns>
    /// <response code="201">User created successfully</response>
    /// <response code="400">Invalid user data</response>
    /// <response code="409">User already exists</response>
    [HttpPost]
    [ProducesResponseType(typeof(UserResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status409Conflict)]
    public async Task<ActionResult<UserResponse>> CreateUser(
        [FromBody] CreateUserRequest request,
        CancellationToken cancellationToken)
    {
        // Implementation
        var user = await _userService.CreateAsync(request, cancellationToken);
        return CreatedAtAction(
            nameof(GetUserById),
            new { id = user.Id },
            user
        );
    }
}
```

### DTO with Data Annotations

```csharp
/// <summary>
/// User response model
/// </summary>
public class UserResponse
{
    /// <summary>
    /// Unique user identifier
    /// </summary>
    /// <example>123</example>
    public int Id { get; set; }

    /// <summary>
    /// Email address
    /// </summary>
    /// <example>user@example.com</example>
    [EmailAddress]
    public string Email { get; set; } = string.Empty;

    /// <summary>
    /// First name
    /// </summary>
    /// <example>John</example>
    [StringLength(50, MinimumLength = 1)]
    public string FirstName { get; set; } = string.Empty;

    /// <summary>
    /// Account creation timestamp
    /// </summary>
    /// <example>2025-01-01T00:00:00Z</example>
    public DateTime CreatedAt { get; set; }
}
```

## Best Practices

1. **Consistency**: Use consistent naming, casing (camelCase for JSON), and structure
2. **Documentation**: Keep OpenAPI spec in sync with code
3. **Versioning**: Plan for API evolution from the start
4. **Security**: Always require authentication for sensitive operations
5. **Validation**: Validate input early and return clear error messages
6. **Pagination**: Always paginate list endpoints
7. **Rate Limiting**: Protect against abuse
8. **CORS**: Configure properly for web clients
9. **HATEOAS**: Consider including links to related resources
10. **Testing**: Test API against OpenAPI spec

## Tools

- **Swagger UI**: Interactive API documentation
- **ReDoc**: Alternative documentation UI
- **Postman**: API testing and collection generation
- **NSwag**: C# client generation
- **Stoplight**: API design and mocking
- **OpenAPI Generator**: Multi-language client generation

Remember: Good API design is about clarity, consistency, and developer experience. Your API is a product—make it easy to understand and use.
