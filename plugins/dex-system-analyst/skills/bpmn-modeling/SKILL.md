---
name: bpmn-modeling
description: Activate when modeling business processes, discussing workflow automation, or creating BPMN diagrams. Contains knowledge about BPMN 2.0 notation, process patterns, and implementation in .NET.
allowed-tools: Read, Write, Edit, Grep
---

# BPMN Modeling Skill

This skill provides comprehensive knowledge about Business Process Model and Notation (BPMN 2.0) for documenting and implementing business workflows in .NET applications.

## What is BPMN?

BPMN (Business Process Model and Notation) is a graphical notation for drawing business processes in a workflow. It provides a standard way to communicate process logic to both business and technical stakeholders.

**Key Benefits**:
- Visual representation of complex processes
- Standardized notation understood globally
- Bridge between business and IT
- Basis for process automation
- Documentation for compliance and audit

## BPMN 2.0 Core Elements

### 1. Events (Круглые символы)

Events represent something that happens during a process.

#### Start Events (O)
Trigger that begins a process:

- **None Start** (empty circle): General start
  - Example: Process begins when user decides to act

- **Message Start** (envelope icon): Receive message
  - Example: Email received, API called

- **Timer Start** (clock icon): Scheduled/delayed start
  - Example: Daily batch job, scheduled report

- **Signal Start** (triangle icon): Broadcast signal received
  - Example: System-wide event notification

- **Conditional Start** (document icon): Condition met
  - Example: Inventory below threshold

#### End Events (O жирный)
Outcome when process completes:

- **None End** (filled circle): Normal completion
  - Example: Process completes successfully

- **Message End** (filled + envelope): Send final message
  - Example: Confirmation email sent

- **Error End** (filled + lightning): Error termination
  - Example: Process failed due to error

- **Terminate End** (filled + solid): Force immediate end
  - Example: Cancel all running activities

#### Intermediate Events (O двойной)
Events during process execution:

- **Timer Intermediate** (clock): Wait for time
  - Example: Wait 24 hours before reminder

- **Message Intermediate** (envelope): Send/receive message
  - Catching: Wait for message
  - Throwing: Send message

- **Error Intermediate** (lightning): Catch error
  - Example: Handle exception in sub-process

- **Signal Intermediate** (triangle): Broadcast/receive signal
  - Example: Notify other processes

### 2. Activities (Прямоугольники)

Activities represent work performed in the process.

#### Tasks (Single rectangle)
Atomic units of work:

- **Task** (no icon): Generic work
  - Example: "Process order"

- **User Task** (person icon): Human interaction
  - Example: "Approve purchase request"
  - Maps to: Manual approval, form submission

- **Service Task** (gear icon): Automated system work
  - Example: "Send email", "Call API"
  - Maps to: C# async method, background job

- **Script Task** (script icon): Execute code
  - Example: "Calculate discount"
  - Maps to: C# expression, business rule

- **Send Task** (filled envelope): Send message
  - Example: "Notify customer"
  - Maps to: Email, SMS, push notification

- **Receive Task** (empty envelope): Wait for message
  - Example: "Wait for payment confirmation"
  - Maps to: Message queue consumer

- **Manual Task** (hand icon): Manual work outside system
  - Example: "Package items"

- **Business Rule Task** (table icon): Execute business rules
  - Example: "Determine shipping cost"
  - Maps to: Rules engine, decision table

#### Sub-Processes (Double rectangle)
Reusable or nested processes:

- **Collapsed Sub-Process** (+ icon): Hidden details
  - Example: "Payment Processing" (details in separate diagram)

- **Expanded Sub-Process**: Visible details
  - Shows nested BPMN elements inside

- **Event Sub-Process** (dashed border): Exception handling
  - Example: Handle errors or timeouts within process

### 3. Gateways (Ромбы)

Gateways control flow splitting and merging.

#### Exclusive Gateway - XOR (empty diamond)
**One path chosen** from multiple options:

```
        → [Path A: Priority]
       /
[XOR] → → [Path B: Standard]
       \
        → [Path C: Economy]
```

**Use when**:
- If-else logic
- One condition must be true
- Mutually exclusive choices

**Example**:
```
<XOR: Order Amount?>
  → [< $100] → Standard Shipping
  → [$100-$500] → Free Shipping
  → [> $500] → Express Shipping
```

**C# Implementation**:
```csharp
if (orderAmount < 100)
    await UseStandardShippingAsync();
else if (orderAmount <= 500)
    await UseFreeShippingAsync();
else
    await UseExpressShippingAsync();
```

#### Parallel Gateway - AND (+ diamond)
**All paths executed** simultaneously:

```
           → [Task A] →
          /              \
[AND Split]  → [Task B] →  [AND Join]
          \              /
           → [Task C] →
```

**Use when**:
- Independent tasks run concurrently
- All paths must complete
- Fork-join pattern

**Example**:
```
<AND Split>
  → Send Email Notification
  → Update Inventory
  → Log Activity
<AND Join>
```

**C# Implementation**:
```csharp
await Task.WhenAll(
    SendEmailNotificationAsync(order),
    UpdateInventoryAsync(order),
    LogActivityAsync(order)
);
```

#### Inclusive Gateway - OR (O diamond)
**One or more paths** can be active:

```
        → [Path A] (if condition A) →
       /                              \
[OR] → → [Path B] (if condition B) →  [OR Join]
       \                              /
        → [Path C] (if condition C) →
```

**Use when**:
- Multiple conditions can be true
- At least one path is taken
- Independent conditions

**Example**:
```
<OR: Notification Preferences?>
  → [Email enabled] → Send Email
  → [SMS enabled] → Send SMS
  → [Push enabled] → Send Push
```

**C# Implementation**:
```csharp
var tasks = new List<Task>();
if (user.EmailNotificationsEnabled)
    tasks.Add(SendEmailAsync(user));
if (user.SmsNotificationsEnabled)
    tasks.Add(SendSmsAsync(user));
if (user.PushNotificationsEnabled)
    tasks.Add(SendPushAsync(user));

await Task.WhenAll(tasks);
```

#### Event-Based Gateway (pentagon)
**Wait for first event** to occur:

```
              → [Approval Message] → Continue
             /
[Event Gateway] → [Timeout (24h)] → Auto-reject
             \
              → [Cancellation Signal] → Cancel
```

**Use when**:
- Waiting for external trigger
- First event wins
- Race condition

**C# Implementation**:
```csharp
using var cts = new CancellationTokenSource(TimeSpan.FromHours(24));

var approvalTask = WaitForApprovalAsync(cts.Token);
var cancellationTask = WaitForCancellationAsync(cts.Token);

var completedTask = await Task.WhenAny(approvalTask, cancellationTask);

if (completedTask == approvalTask)
    await ProcessApprovalAsync();
else if (completedTask == cancellationTask)
    await CancelRequestAsync();
```

### 4. Connecting Objects

#### Sequence Flow (→)
Shows order of activities:
- Solid arrow
- Indicates "happens after"
- Can have conditions (XOR gateway branches)

#### Message Flow (--→)
Communication between participants:
- Dashed arrow
- Crosses pool boundaries
- Shows messages/data exchange

#### Association (···→)
Links artifacts to elements:
- Dotted line
- Connects data objects, annotations
- Non-controlling flow

### 5. Swimlanes

#### Pools
Represent participants (organizations, systems):
```
═══════════════════════════════════════
║ Customer                            ║
║ [Start] → (Place Order) → [End]    ║
═══════════════════════════════════════
║ Order System                        ║
║ [Receive] → (Process) → (Ship)     ║
═══════════════════════════════════════
```

#### Lanes
Subdivide pools by roles:
```
═══════════════════════════════════════
║ Sales Department                    ║
├─────────────────────────────────────┤
║ Sales Rep         │                 ║
║ (Receive Order)   │                 ║
├───────────────────┤                 ║
║ Sales Manager     │                 ║
║                   │ (Approve Order) ║
═══════════════════════════════════════
```

## BPMN Process Patterns

### Pattern 1: Sequential Process
Simple linear workflow:
```
[Start] → (Task 1) → (Task 2) → (Task 3) → [End]
```

**Example**: User Registration
```
[Start: User clicks Register]
  → (User Task: Fill form)
  → (Service Task: Validate data)
  → (Service Task: Create account)
  → (Send Task: Send confirmation email)
  → [End: Registration complete]
```

### Pattern 2: Exclusive Choice (XOR)
One path based on condition:
```
[Start] → (Evaluate) → <XOR>
                         → [Condition A] → (Task A) → [End]
                         → [Condition B] → (Task B) → [End]
                         → [Condition C] → (Task C) → [End]
```

**Example**: Order Approval
```
[Start: Order received]
  → (Calculate total)
  → <XOR: Order amount?>
      → [< $1,000] → (Auto-approve) → [End]
      → [>= $1,000] → (User Task: Manager approval) → [End]
```

### Pattern 3: Parallel Execution (AND)
Multiple tasks simultaneously:
```
[Start] → <AND Split>
              → (Task A) →
              → (Task B) →  <AND Join> → [End]
              → (Task C) →
```

**Example**: Order Processing
```
[Start: Order confirmed]
  → <AND Split>
      → (Reserve inventory)
      → (Charge payment)
      → (Send confirmation email)
  → <AND Join>
  → [End: All tasks complete]
```

### Pattern 4: Loop (Iteration)
Repeat task until condition:
```
[Start] → (Task) → <XOR: Done?>
                     → [No] ⤾ (loop back to Task)
                     → [Yes] → [End]
```

**Example**: Retry Payment
```
[Start: Payment failed]
  → (Attempt payment)
  → <XOR: Success OR max retries?>
      → [Failed AND retries < 3] ⤾ (retry after 1 min)
      → [Success OR retries = 3] → [End]
```

### Pattern 5: Escalation with Timeout
Wait with timeout handling:
```
[Start] → (Request approval)
            ↓
        [Timer: 24 hours]
            ↓
          <XOR>
            → [Approved] → (Process) → [End]
            → [Timeout] → (Escalate) → (Manager approves) → [End]
```

**Example**: Purchase Approval
```
[Start: Purchase requested]
  → (User Task: Approver reviews)
  → [Intermediate Timer: 24 hours]
  → <XOR: Approved before timeout?>
      → [Yes] → (Process purchase) → [End]
      → [No] → (Escalate to director) → [End]
```

### Pattern 6: Error Handling
Catch and handle errors:
```
[Start] → (Sub-Process: Risky operation)
              ↓
          [Error Event]
              ↓
          (Handle error) → <XOR>
                             → [Retry] ⤾ (back to sub-process)
                             → [Abort] → [Error End]
```

**Example**: API Call with Retry
```
[Start: Call external API]
  → (Service Task: HTTP request)
      ↓
    [Error Event: HTTP 5xx]
      ↓
    (Log error)
    → <XOR: Retry count < 3?>
        → [Yes] → Wait 5 sec → ⤾ (retry request)
        → [No] → [Error End]
```

## .NET Implementation Patterns

### Service Task → Async Method
```csharp
// BPMN: Service Task "Process Payment"
public class PaymentService
{
    public async Task<Result<Payment>> ProcessPaymentAsync(
        Order order,
        CancellationToken cancellationToken = default)
    {
        // Payment processing logic
        var payment = await _paymentGateway.ChargeAsync(
            order.Total,
            order.PaymentMethod,
            cancellationToken
        );

        return Result.Success(payment);
    }
}
```

### User Task → API Endpoint
```csharp
// BPMN: User Task "Approve Order"
[HttpPost("orders/{id}/approve")]
[Authorize(Roles = "Manager")]
public async Task<IActionResult> ApproveOrder(
    int id,
    [FromBody] ApprovalDto approval,
    CancellationToken cancellationToken)
{
    var result = await _orderService.ApproveOrderAsync(
        id,
        approval,
        cancellationToken
    );

    return result.IsSuccess
        ? Ok(result.Value)
        : BadRequest(result.Error);
}
```

### XOR Gateway → Switch/If-Else
```csharp
// BPMN: XOR Gateway "Shipping Method"
public async Task<Shipment> CreateShipmentAsync(Order order)
{
    return order.ShippingMethod switch
    {
        ShippingMethod.Standard => await CreateStandardShipmentAsync(order),
        ShippingMethod.Express => await CreateExpressShipmentAsync(order),
        ShippingMethod.Overnight => await CreateOvernightShipmentAsync(order),
        _ => throw new ArgumentException("Unknown shipping method")
    };
}
```

### AND Gateway → Task.WhenAll
```csharp
// BPMN: Parallel Gateway (AND Split/Join)
public async Task ProcessOrderAsync(Order order)
{
    // AND Split: Execute in parallel
    await Task.WhenAll(
        UpdateInventoryAsync(order),
        SendConfirmationEmailAsync(order),
        LogOrderActivityAsync(order),
        NotifyWarehouseAsync(order)
    );
    // AND Join: Continue after all complete

    await FinalizeOrderAsync(order);
}
```

### OR Gateway → Conditional Tasks
```csharp
// BPMN: Inclusive Gateway (OR Split/Join)
public async Task SendNotificationsAsync(User user, Order order)
{
    var tasks = new List<Task>();

    // OR Split: Check each condition independently
    if (user.EmailNotificationsEnabled)
        tasks.Add(SendEmailAsync(user, order));

    if (user.SmsNotificationsEnabled)
        tasks.Add(SendSmsAsync(user, order));

    if (user.PushNotificationsEnabled)
        tasks.Add(SendPushAsync(user, order));

    // OR Join: Wait for all active paths
    if (tasks.Any())
        await Task.WhenAll(tasks);
}
```

### Timer Event → Background Job
```csharp
// BPMN: Timer Start Event "Daily Report"
public class ReportScheduler
{
    public void ConfigureJobs()
    {
        // Cron: Every day at 6:00 AM UTC
        RecurringJob.AddOrUpdate<ReportService>(
            "daily-report",
            service => service.GenerateDailyReportAsync(CancellationToken.None),
            "0 6 * * *",
            new RecurringJobOptions { TimeZone = TimeZoneInfo.Utc }
        );
    }
}

// BPMN: Intermediate Timer Event "Wait 24 hours"
public async Task SendReminderAsync(Order order)
{
    // Schedule reminder for 24 hours later
    BackgroundJob.Schedule<NotificationService>(
        service => service.SendOrderReminderAsync(order.Id, CancellationToken.None),
        TimeSpan.FromHours(24)
    );
}
```

### Message Events → Message Bus
```csharp
// BPMN: Send Message Event
public async Task PublishOrderCreatedAsync(Order order)
{
    await _messageBus.PublishAsync(
        new OrderCreatedEvent
        {
            OrderId = order.Id,
            CustomerId = order.CustomerId,
            Total = order.Total,
            CreatedAt = DateTime.UtcNow
        }
    );
}

// BPMN: Receive Message Event
public class WarehouseService
{
    public async Task StartAsync(CancellationToken cancellationToken)
    {
        await _messageBus.SubscribeAsync<OrderCreatedEvent>(
            async (evt, ct) => await ProcessNewOrderAsync(evt, ct),
            cancellationToken
        );
    }
}
```

### Error Event → Try-Catch
```csharp
// BPMN: Sub-Process with Error Boundary Event
public async Task<Result> ProcessPaymentWithRetryAsync(Order order)
{
    const int maxRetries = 3;
    int attempt = 0;

    while (attempt < maxRetries)
    {
        try
        {
            // Sub-Process: Payment processing
            var payment = await _paymentGateway.ChargeAsync(order);
            return Result.Success();
        }
        catch (PaymentException ex)
        {
            // Error Event: Payment failed
            attempt++;
            _logger.LogWarning(ex, "Payment attempt {Attempt} failed", attempt);

            if (attempt >= maxRetries)
            {
                // Error End: Max retries exceeded
                return Result.Failure("Payment failed after 3 attempts");
            }

            // Wait before retry
            await Task.Delay(TimeSpan.FromSeconds(5));
        }
    }

    return Result.Failure("Unexpected error");
}
```

### Sub-Process → Orchestration Method
```csharp
// BPMN: Sub-Process "Order Fulfillment"
public async Task<Result> FulfillOrderAsync(Order order, CancellationToken cancellationToken)
{
    // This method represents a collapsed sub-process
    // It can have its own detailed BPMN diagram

    // Step 1: Validate inventory
    var inventoryResult = await ValidateInventoryAsync(order, cancellationToken);
    if (!inventoryResult.IsSuccess)
        return inventoryResult;

    // Step 2: Process payment
    var paymentResult = await ProcessPaymentAsync(order, cancellationToken);
    if (!paymentResult.IsSuccess)
    {
        await ReleaseInventoryAsync(order, cancellationToken);
        return paymentResult;
    }

    // Step 3: Create shipment
    var shipmentResult = await CreateShipmentAsync(order, cancellationToken);
    if (!shipmentResult.IsSuccess)
    {
        await RefundPaymentAsync(order, cancellationToken);
        await ReleaseInventoryAsync(order, cancellationToken);
        return shipmentResult;
    }

    // Step 4: Notify customer
    await NotifyCustomerAsync(order, cancellationToken);

    return Result.Success();
}
```

## Process Documentation Template

When documenting a BPMN process, include:

```markdown
# Process: [Name]

## Overview
- **Purpose**: [Why this process exists]
- **Trigger**: [What starts the process]
- **Frequency**: [How often it runs]
- **Duration**: [Expected completion time]
- **Owner**: [Responsible team/person]

## Participants
- **Pool 1**: [Name] - [Description]
- **Pool 2**: [Name] - [Description]

## Process Flow

### Happy Path
1. [Step 1 description]
2. [Step 2 description]
3. [Step 3 description]

### Alternative Paths
- **Path A**: [When does this happen?]
- **Path B**: [When does this happen?]

### Exception Handling
- **Error 1**: [How is it handled?]
- **Error 2**: [How is it handled?]

## BPMN Diagram

[Text-based representation or image]

## Business Rules
- Rule 1: [Description]
- Rule 2: [Description]

## Integration Points
- **System A**: [API endpoint, message queue, etc.]
- **System B**: [API endpoint, message queue, etc.]

## Performance Requirements
- **Response Time**: [Target]
- **Throughput**: [Target]
- **SLA**: [Target]

## Monitoring
- **KPIs**: [What to measure]
- **Alerts**: [When to alert]
- **Dashboards**: [What to display]

## Implementation Notes
- **Technology**: [Frameworks, libraries]
- **Data Storage**: [Databases, caches]
- **Message Broker**: [RabbitMQ, Azure Service Bus, etc.]
- **Scheduler**: [Hangfire, Quartz, etc.]
```

## Best Practices

1. **Start Simple**: Model happy path first, add exceptions later
2. **Use Consistent Naming**: Verb-noun for tasks (e.g., "Approve Order")
3. **Balance Gateways**: Every split must have a corresponding join
4. **Limit Complexity**: Max 15-20 elements per diagram
5. **Use Swimlanes**: Show responsibilities clearly
6. **Document Conditions**: Label gateway branches with conditions
7. **Handle Errors**: Don't ignore exception scenarios
8. **Validate Flow**: Ensure all paths lead to end events
9. **Review with Stakeholders**: Business must understand the model
10. **Keep Updated**: Reflect changes in implementation

## Common Mistakes

- **Unbalanced Gateways**: Split without join or vice versa
- **Missing End Events**: Flows that don't terminate
- **Overusing Message Flow**: Use sequence flow within pools
- **Too Much Detail**: Include implementation details
- **Vague Task Names**: "Process data" instead of "Calculate order total"
- **Ignoring Errors**: Only modeling happy path
- **Crossing Boundaries**: Sequence flow crossing pool boundaries

Remember: BPMN is a communication tool. The diagram should be understandable by both business stakeholders and developers. Keep it at the right level of abstraction for your audience.
