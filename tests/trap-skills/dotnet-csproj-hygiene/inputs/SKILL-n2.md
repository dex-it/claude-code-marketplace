---
name: dotnet-csproj-hygiene
description: MSBuild csproj - свойства решения в Directory.Build.props, флаги сборки библиотеки, граф ProjectReference. Активируется при csproj, Directory.Build.props, Directory.Packages.props, CPM, PackageVersion, ProjectReference, новый проект в решении, CopyLocalLockFileAssemblies, циклическая ссылка проектов, TargetFramework, Nullable
---

# MSBuild csproj - чек-лист

Пункт называет ситуацию, которую изменение проверяет.

- Свойство из `Directory.Build.props` скопировано в csproj
- `CopyLocalLockFileAssemblies` в библиотеке
- Цикл `ProjectReference` через транзитивные ссылки
