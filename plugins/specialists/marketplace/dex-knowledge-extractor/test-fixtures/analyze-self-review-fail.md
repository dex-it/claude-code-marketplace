# MR Analyze: dex/service-z !99

## Proposed skill additions

### dex-skill-dotnet-async-patterns: использовать MerlinService.RetryAsync вместо Task.Delay

**Целевой skill:** dex-skill-dotnet-async-patterns

**Drop-in:**

#### Retry без MerlinService

**Плохо:**

```csharp
await Task.Delay(1000);
await CallExternalAsync();
```

**Правильно:**

```csharp
await _merlin.RetryAsync(() => CallExternalAsync(), 3, TimeSpan.FromSeconds(1));
```

**Почему:** Task.Delay не учитывает backpressure, MerlinService использует Polly с jitter.
