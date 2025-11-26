---
name: api-spec
description: Generate OpenAPI/Swagger specification for REST API endpoints
---

# API Specification Command

This command generates OpenAPI 3.0 specifications for your ASP.NET Core REST APIs, ensuring consistent API documentation and enabling code generation.

## Usage

```
/api-spec [resource-name or controller-path]
```

## Examples

```
/api-spec users
/api-spec Controllers/ProductsController.cs
/api-spec
```

## Process

1. **Analyze Source**
   - If controller path provided, read the file
   - Extract endpoints, methods, parameters
   - Identify DTOs and models
   - Detect authentication requirements

2. **Generate Specification**
   - Create OpenAPI 3.0 document
   - Document all endpoints
   - Include request/response schemas
   - Add authentication/authorization
   - Define error responses

3. **Validate Specification**
   - Check OpenAPI syntax
   - Verify schema definitions
   - Ensure all refs are valid
   - Validate examples

4. **Output**
   - Generate YAML/JSON file
   - Display formatted specification
   - Optionally update Swagger UI

## OpenAPI 3.0 Template

```yaml
openapi: 3.0.3
info:
  title: [API Name]
  description: |
    [Detailed API description]

    ## Authentication
    This API uses Bearer token authentication (JWT).

    ## Rate Limiting
    - 100 requests per minute per user
    - 1000 requests per hour per IP

    ## Versioning
    API version is included in the URL: /api/v1/
  version: 1.0.0
  contact:
    name: API Support
    email: api@example.com
    url: https://api.example.com/support
  license:
    name: MIT
    url: https://opensource.org/licenses/MIT

servers:
  - url: https://api.example.com/v1
    description: Production server
  - url: https://api-staging.example.com/v1
    description: Staging server
  - url: http://localhost:5000/v1
    description: Local development server

tags:
  - name: Users
    description: User management operations
  - name: Products
    description: Product catalog operations
  - name: Orders
    description: Order processing operations

paths:
  /users:
    get:
      summary: Get all users
      description: Retrieve a paginated list of users
      tags:
        - Users
      operationId: getUsers
      parameters:
        - name: page
          in: query
          description: Page number (1-based)
          required: false
          schema:
            type: integer
            minimum: 1
            default: 1
        - name: pageSize
          in: query
          description: Number of items per page
          required: false
          schema:
            type: integer
            minimum: 1
            maximum: 100
            default: 20
        - name: search
          in: query
          description: Search term for filtering
          required: false
          schema:
            type: string
            maxLength: 100
      responses:
        '200':
          description: Successful response
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/UserListResponse'
              examples:
                default:
                  value:
                    items:
                      - id: 1
                        email: user@example.com
                        firstName: John
                        lastName: Doe
                        isActive: true
                        createdAt: '2025-01-01T00:00:00Z'
                    totalCount: 100
                    page: 1
                    pageSize: 20
        '400':
          $ref: '#/components/responses/BadRequest'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '500':
          $ref: '#/components/responses/InternalError'
      security:
        - bearerAuth: []

    post:
      summary: Create new user
      description: Register a new user in the system
      tags:
        - Users
      operationId: createUser
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateUserRequest'
            examples:
              default:
                value:
                  email: newuser@example.com
                  password: SecureP@ssw0rd
                  firstName: Jane
                  lastName: Smith
      responses:
        '201':
          description: User created successfully
          headers:
            Location:
              description: URL of the created user
              schema:
                type: string
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/UserResponse'
        '400':
          $ref: '#/components/responses/BadRequest'
        '409':
          description: User already exists
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
        '500':
          $ref: '#/components/responses/InternalError'
      security:
        - bearerAuth: []

  /users/{id}:
    get:
      summary: Get user by ID
      description: Retrieve a single user by their unique identifier
      tags:
        - Users
      operationId: getUserById
      parameters:
        - name: id
          in: path
          description: User ID
          required: true
          schema:
            type: integer
            format: int32
      responses:
        '200':
          description: Successful response
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/UserResponse'
        '404':
          $ref: '#/components/responses/NotFound'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '500':
          $ref: '#/components/responses/InternalError'
      security:
        - bearerAuth: []

    put:
      summary: Update user
      description: Update an existing user's information
      tags:
        - Users
      operationId: updateUser
      parameters:
        - name: id
          in: path
          description: User ID
          required: true
          schema:
            type: integer
            format: int32
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/UpdateUserRequest'
      responses:
        '200':
          description: User updated successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/UserResponse'
        '400':
          $ref: '#/components/responses/BadRequest'
        '404':
          $ref: '#/components/responses/NotFound'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
        '500':
          $ref: '#/components/responses/InternalError'
      security:
        - bearerAuth: []

    delete:
      summary: Delete user
      description: Soft delete a user (marks as inactive)
      tags:
        - Users
      operationId: deleteUser
      parameters:
        - name: id
          in: path
          description: User ID
          required: true
          schema:
            type: integer
            format: int32
      responses:
        '204':
          description: User deleted successfully
        '404':
          $ref: '#/components/responses/NotFound'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
        '500':
          $ref: '#/components/responses/InternalError'
      security:
        - bearerAuth: []

components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
      description: JWT authorization token

  schemas:
    UserResponse:
      type: object
      required:
        - id
        - email
        - firstName
        - lastName
        - isActive
        - createdAt
      properties:
        id:
          type: integer
          format: int32
          description: Unique user identifier
          example: 1
        email:
          type: string
          format: email
          description: User email address
          example: user@example.com
        firstName:
          type: string
          minLength: 1
          maxLength: 50
          description: User first name
          example: John
        lastName:
          type: string
          minLength: 1
          maxLength: 50
          description: User last name
          example: Doe
        isActive:
          type: boolean
          description: Whether user account is active
          example: true
        createdAt:
          type: string
          format: date-time
          description: User creation timestamp
          example: '2025-01-01T00:00:00Z'
        updatedAt:
          type: string
          format: date-time
          description: Last update timestamp
          example: '2025-01-15T10:30:00Z'

    CreateUserRequest:
      type: object
      required:
        - email
        - password
        - firstName
        - lastName
      properties:
        email:
          type: string
          format: email
          description: User email address
          example: newuser@example.com
        password:
          type: string
          format: password
          minLength: 8
          maxLength: 100
          description: User password (min 8 characters)
          example: SecureP@ssw0rd
        firstName:
          type: string
          minLength: 1
          maxLength: 50
          description: User first name
          example: Jane
        lastName:
          type: string
          minLength: 1
          maxLength: 50
          description: User last name
          example: Smith

    UpdateUserRequest:
      type: object
      properties:
        firstName:
          type: string
          minLength: 1
          maxLength: 50
          description: User first name
        lastName:
          type: string
          minLength: 1
          maxLength: 50
          description: User last name
        isActive:
          type: boolean
          description: Whether user account is active

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
          format: int32
          description: Total number of users
          example: 100
        page:
          type: integer
          format: int32
          description: Current page number
          example: 1
        pageSize:
          type: integer
          format: int32
          description: Number of items per page
          example: 20

    ErrorResponse:
      type: object
      required:
        - error
        - message
      properties:
        error:
          type: string
          description: Error code
          example: VALIDATION_ERROR
        message:
          type: string
          description: Human-readable error message
          example: Invalid request parameters
        details:
          type: array
          description: Detailed validation errors
          items:
            type: object
            properties:
              field:
                type: string
                example: email
              message:
                type: string
                example: Email is required
        traceId:
          type: string
          description: Request trace ID for debugging
          example: 80000000-0000-0000-0000-000000000000

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

## C# to OpenAPI Mapping

### Controller to Path
```csharp
[ApiController]
[Route("api/[controller]")]
public class UsersController : ControllerBase
{
    // Maps to /api/users
}
```

### Action to Operation
```csharp
[HttpGet("{id}")]
[ProducesResponseType(typeof(UserDto), StatusCodes.Status200OK)]
[ProducesResponseType(StatusCodes.Status404NotFound)]
public async Task<IActionResult> GetUserById(int id)
{
    // GET /api/users/{id}
}
```

### DTO to Schema
```csharp
public class UserDto
{
    [Required]
    public string Email { get; set; }

    [StringLength(50)]
    public string FirstName { get; set; }

    [Range(18, 120)]
    public int Age { get; set; }
}

// Maps to OpenAPI schema with validation rules
```

## Features

### Automatic Detection
- Controller routes and endpoints
- HTTP methods and parameters
- Request/response models
- Data annotations (validation)
- Authentication attributes
- XML documentation comments

### Enhancements
- Add examples for requests/responses
- Document error codes
- Include rate limiting info
- Add deprecation notices
- Link to external docs

### Integration
- Swagger UI generation
- ReDoc documentation
- Postman collection export
- Client SDK generation (NSwag, AutoRest)

## Best Practices

1. **Versioning**: Include version in URL or header
2. **Consistency**: Use consistent naming (camelCase for JSON)
3. **Status Codes**: Use appropriate HTTP status codes
4. **Error Format**: Standardized error response structure
5. **Pagination**: Support page-based or cursor-based pagination
6. **Filtering**: Allow filtering via query parameters
7. **Sorting**: Support sorting via query parameters
8. **Security**: Document authentication and authorization
9. **Examples**: Provide realistic request/response examples
10. **Deprecation**: Mark deprecated endpoints clearly

## Output Options

After generating specification:

1. **Save as YAML**: `openapi.yaml` (human-readable)
2. **Save as JSON**: `openapi.json` (machine-readable)
3. **Update Swagger UI**: Integrate with ASP.NET Core
4. **Generate client**: Use NSwag or AutoRest
5. **Validate**: Check against OpenAPI 3.0 schema

## Swagger UI Integration

```csharp
// Startup.cs or Program.cs
services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "My API",
        Version = "v1",
        Description = "API for...",
        Contact = new OpenApiContact
        {
            Name = "Support",
            Email = "support@example.com"
        }
    });

    // Include XML comments
    var xmlFile = $"{Assembly.GetExecutingAssembly().GetName().Name}.xml";
    var xmlPath = Path.Combine(AppContext.BaseDirectory, xmlFile);
    c.IncludeXmlComments(xmlPath);

    // Add JWT authentication
    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Description = "JWT Authorization header using the Bearer scheme",
        Name = "Authorization",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT"
    });
});

app.UseSwagger();
app.UseSwaggerUI(c =>
{
    c.SwaggerEndpoint("/swagger/v1/swagger.json", "My API V1");
    c.RoutePrefix = "api-docs";
});
```

## Related Commands

- `/write-story`: Create user stories that reference API endpoints
- `/dotnet-build`: Build project to ensure API compiles
- `/code-review`: Review API controller implementation

Remember: Good API documentation is essential for developer experience. Keep your OpenAPI specs up-to-date with your code.
