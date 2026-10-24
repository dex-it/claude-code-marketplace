FROM mcr.microsoft.com/dotnet/sdk:8.0.404 AS build
WORKDIR /src
COPY global.json Directory.Build.props Directory.Packages.props ./
COPY src/Depot.Contracts/Depot.Contracts.csproj src/Depot.Contracts/
COPY src/Depot.Api/Depot.Api.csproj src/Depot.Api/
RUN dotnet restore src/Depot.Api/Depot.Api.csproj
COPY src/ src/
RUN dotnet publish src/Depot.Api/Depot.Api.csproj -c Release -o /app --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:8.0.11
WORKDIR /app
COPY --from=build /app .
USER 1654
EXPOSE 8080
ENTRYPOINT ["dotnet", "Depot.Api.dll"]
