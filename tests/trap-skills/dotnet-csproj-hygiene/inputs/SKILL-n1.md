---
name: dotnet-csproj-hygiene
description: MSBuild csproj - свойства решения в Directory.Build.props, флаги сборки библиотеки, граф ProjectReference, версии CPM. Активируется при csproj, Directory.Build.props, Directory.Packages.props, CPM, ProjectReference, новый проект в решении, CopyLocalLockFileAssemblies, циклическая ссылка проектов, NU1603
---

# MSBuild csproj - чек-лист

Пункт называет ситуацию, которую изменение проверяет.

- Свойство из `Directory.Build.props` скопировано в csproj
- `CopyLocalLockFileAssemblies` в библиотеке
- Цикл `ProjectReference` через транзитивные ссылки
- Версия CPM, которой нет на фиде (NU1603)
