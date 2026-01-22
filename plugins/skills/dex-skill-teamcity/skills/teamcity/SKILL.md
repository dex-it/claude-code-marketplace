---
name: teamcity-patterns
description: TeamCity CI/CD паттерны, build configurations, meta-runners для .NET. Активируется при teamcity, build configuration, meta-runner, artifact, build chain
allowed-tools: Read, Grep, Glob
---

# TeamCity Patterns для .NET

## Build Configuration Basics

### Структура проекта в TeamCity

```
Root Project
├── MyApp (Project)
│   ├── Build (Config)
│   ├── Test (Config)
│   ├── Publish (Config)
│   └── Deploy (Config)
├── Templates (Project)
│   └── .NET Build Template
└── Shared (Project)
    └── Reusable Parameters
```

### Параметры сборки

```
# System Parameters (system.*)
system.teamcity.build.checkoutDir = %teamcity.build.workingDir%
system.Configuration = Release
system.Platform = Any CPU

# Environment Variables (env.*)
env.DOTNET_CLI_TELEMETRY_OPTOUT = true
env.NUGET_PACKAGES = %system.teamcity.build.checkoutDir%/.nuget

# Configuration Parameters
my.solution.path = src/MyApp.sln
my.publish.output = %system.teamcity.build.checkoutDir%/publish
```

## Build Steps для .NET

### 1. NuGet Restore

```xml
<build-runners>
  <runner type=".NET">
    <parameters>
      <param name="command" value="restore"/>
      <param name="paths" value="%my.solution.path%"/>
      <param name="args" value="--configfile NuGet.config"/>
    </parameters>
  </runner>
</build-runners>
```

### 2. Build

```xml
<runner type=".NET">
  <parameters>
    <param name="command" value="build"/>
    <param name="paths" value="%my.solution.path%"/>
    <param name="args" value="--configuration %system.Configuration% --no-restore"/>
  </parameters>
</runner>
```

### 3. Test

```xml
<runner type=".NET">
  <parameters>
    <param name="command" value="test"/>
    <param name="paths" value="%my.solution.path%"/>
    <param name="args" value="--configuration %system.Configuration% --no-build --logger teamcity"/>
  </parameters>
</runner>
```

### 4. Publish

```xml
<runner type=".NET">
  <parameters>
    <param name="command" value="publish"/>
    <param name="paths" value="src/MyApp.Api/MyApp.Api.csproj"/>
    <param name="args" value="--configuration %system.Configuration% --output %my.publish.output% --no-build"/>
  </parameters>
</runner>
```

## Build Features

### Automatic Merge

```xml
<build-feature type="AutoMerge">
  <parameters>
    <param name="teamcity.auto.merge.target.branches" value="develop"/>
    <param name="teamcity.auto.merge.condition" value="always"/>
  </parameters>
</build-feature>
```

### Build Status Publisher

```xml
<build-feature type="commit-status-publisher">
  <parameters>
    <param name="publisherId" value="gitlab"/>
    <param name="gitlab.url" value="https://gitlab.example.com"/>
    <param name="gitlab.token" value="%gitlab.api.token%"/>
  </parameters>
</build-feature>
```

### File Content Replacer

```xml
<build-feature type="FileContentReplacer">
  <parameters>
    <param name="teamcity.file.content.replacer.pattern" value="**/*.csproj"/>
    <param name="teamcity.file.content.replacer.regexp" value="&lt;Version&gt;.*&lt;/Version&gt;"/>
    <param name="teamcity.file.content.replacer.replacement" value="&lt;Version&gt;%build.number%&lt;/Version&gt;"/>
  </parameters>
</build-feature>
```

## Artifact Paths

```
# Publish output
publish/** => MyApp-%build.number%.zip

# Test results
**/TestResults/**/*.trx => test-results.zip

# Code coverage
**/coverage/**/* => coverage.zip

# NuGet packages
**/*.nupkg => packages
```

## Artifact Dependencies

### Настройка зависимости

```xml
<artifact-dependency>
  <source-build-type id="MyApp_Build"/>
  <artifact-path value="MyApp-*.zip!**" />
  <destination-folder value="build-artifacts"/>
  <clean-destination-folder value="true"/>
</artifact-dependency>
```

## Build Chains

### Snapshot Dependency

```
Build → Test → Publish → Deploy

Build Configuration: Deploy
├── Snapshot Dependency: Publish
│   ├── Snapshot Dependency: Test
│   │   └── Snapshot Dependency: Build
```

### Параллельные сборки

```
         ┌─ Unit Tests ────┐
Build ───┼─ Integration Tests ─┼── Publish
         └─ E2E Tests ─────┘
```

## Triggers

### VCS Trigger

```xml
<trigger type="vcsTrigger">
  <parameters>
    <param name="branchFilter" value="+:*"/>
    <param name="quietPeriodMode" value="USE_DEFAULT"/>
    <param name="triggerRules" value="+:**"/>
  </parameters>
</trigger>
```

### Schedule Trigger

```xml
<trigger type="schedulingTrigger">
  <parameters>
    <param name="schedulingPolicy" value="daily"/>
    <param name="hour" value="2"/>
    <param name="minute" value="0"/>
    <param name="timezone" value="Europe/Moscow"/>
    <param name="triggerBuildOnAllCompatibleAgents" value="false"/>
  </parameters>
</trigger>
```

### Finish Build Trigger

```xml
<trigger type="buildDependencyTrigger">
  <parameters>
    <param name="dependsOn" value="MyApp_Build"/>
    <param name="branchFilter" value="+:main"/>
  </parameters>
</trigger>
```

## Build Templates

### .NET Build Template

```xml
<template id="DotNet_Build_Template">
  <name>.NET Build Template</name>
  <settings>
    <parameters>
      <param name="solution.path" spec="text display='normal' label='Solution path' validationMode='any'"/>
      <param name="dotnet.configuration" value="Release" spec="select display='normal' label='Configuration' options=['Debug','Release']"/>
    </parameters>

    <build-runners>
      <runner name="Restore" type=".NET">
        <parameters>
          <param name="command" value="restore"/>
          <param name="paths" value="%solution.path%"/>
        </parameters>
      </runner>
      <runner name="Build" type=".NET">
        <parameters>
          <param name="command" value="build"/>
          <param name="paths" value="%solution.path%"/>
          <param name="args" value="-c %dotnet.configuration% --no-restore"/>
        </parameters>
      </runner>
      <runner name="Test" type=".NET">
        <parameters>
          <param name="command" value="test"/>
          <param name="paths" value="%solution.path%"/>
          <param name="args" value="-c %dotnet.configuration% --no-build --logger teamcity"/>
        </parameters>
      </runner>
    </build-runners>

    <build-features>
      <feature type="xml-report-plugin">
        <param name="xmlReportParsing.reportType" value="trx"/>
        <param name="xmlReportParsing.reportDirs" value="**/TestResults/*.trx"/>
      </feature>
    </build-features>
  </settings>
</template>
```

## Meta-Runners

### Docker Build Meta-Runner

```xml
<?xml version="1.0" encoding="UTF-8"?>
<meta-runner name="Docker Build and Push">
  <description>Build Docker image and push to registry</description>
  <settings>
    <parameters>
      <param name="docker.image.name" spec="text label='Image Name' validationMode='not_empty'"/>
      <param name="docker.image.tag" value="%build.number%" spec="text label='Image Tag'"/>
      <param name="docker.registry" spec="text label='Registry URL'"/>
      <param name="dockerfile.path" value="Dockerfile" spec="text label='Dockerfile Path'"/>
    </parameters>
    <build-runners>
      <runner name="Docker Build" type="DockerBuild">
        <parameters>
          <param name="dockerfile.path" value="%dockerfile.path%"/>
          <param name="docker.image.namesAndTags" value="%docker.registry%/%docker.image.name%:%docker.image.tag%"/>
          <param name="docker.push.target" value="%docker.registry%"/>
        </parameters>
      </runner>
    </build-runners>
  </settings>
</meta-runner>
```

## Failure Conditions

```xml
<failure-conditions>
  <!-- Fail on metric change -->
  <failure-condition type="BuildFailureOnMetric">
    <param name="metricKey" value="buildTestCount"/>
    <param name="metricThreshold" value="0"/>
    <param name="metricComparison" value="less"/>
  </failure-condition>

  <!-- Fail on text in build log -->
  <failure-condition type="BuildFailureOnText">
    <param name="pattern" value="OutOfMemoryException"/>
    <param name="failOnError" value="true"/>
  </failure-condition>

  <!-- Fail on build duration -->
  <failure-condition type="BuildDuration">
    <param name="buildDuration" value="3600"/>
  </failure-condition>
</failure-conditions>
```

## Agent Requirements

```xml
<agent-requirements>
  <!-- .NET SDK version -->
  <requirement type="equals" name="DotNetCoreSDK8.0_Path" value="%env.DotNetCoreSDK8.0_Path%"/>

  <!-- Docker -->
  <requirement type="exists" name="docker.version"/>

  <!-- OS -->
  <requirement type="equals" name="teamcity.agent.jvm.os.name" value="Linux"/>

  <!-- Custom capability -->
  <requirement type="equals" name="env.HAS_GPU" value="true"/>
</agent-requirements>
```

## Kotlin DSL

```kotlin
// .teamcity/settings.kts
import jetbrains.buildServer.configs.kotlin.*
import jetbrains.buildServer.configs.kotlin.buildSteps.dotnetBuild
import jetbrains.buildServer.configs.kotlin.buildSteps.dotnetTest

version = "2024.07"

project {
    buildType(Build)
    buildType(Test)
}

object Build : BuildType({
    name = "Build"

    vcs {
        root(DslContext.settingsRoot)
    }

    steps {
        dotnetBuild {
            projects = "src/MyApp.sln"
            configuration = "Release"
        }
    }

    artifactRules = "publish/** => MyApp-%build.number%.zip"
})

object Test : BuildType({
    name = "Test"

    dependencies {
        snapshot(Build) {}
    }

    steps {
        dotnetTest {
            projects = "src/MyApp.sln"
            configuration = "Release"
            args = "--logger teamcity"
        }
    }
})
```

## Best Practices

1. **Используйте Templates** для переиспользования конфигураций
2. **Версионируйте настройки** через Kotlin DSL
3. **Параметризуйте всё** - пути, версии, секреты
4. **Используйте Build Chains** для зависимых сборок
5. **Настройте Failure Conditions** для раннего обнаружения проблем
6. **Храните секреты** в TeamCity Parameters как password type
7. **Используйте Agent Requirements** для правильного распределения сборок
