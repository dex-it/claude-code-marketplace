Фоновый запуск сервиса (`dotnet run`) остановлен по лимиту времени. Он был нужен только для проверки, и на работу это не влияет.

Список изменённых файлов остаётся прежним:

- `src/Bookings.Api/Bookings.Api.csproj`
- `src/Bookings.Api/Program.cs`
- `src/Bookings.Api/Contracts/BookingDto.cs`
- `src/Bookings.Api/Contracts/CreateBookingRequest.cs`
- `src/Bookings.Api/Contracts/CursorPageDto.cs`
- `src/Bookings.Api/Contracts/PageDto.cs`
- `src/Bookings.Api/Contracts/RescheduleBookingRequest.cs`
- `src/Bookings.Api/Contracts/RoomDto.cs`
- `src/Bookings.Api/Controllers/BookingsController.cs`
- `src/Bookings.Api/Controllers/RoomsController.cs`
- `src/Bookings.Api/Swagger/ProblemExampleAttribute.cs` (новый)
- `src/Bookings.Api/Swagger/ProblemExamplesOperationFilter.cs` (новый)
- `src/Bookings.Api/Swagger/ExampleSchemaFilter.cs` (новый)
