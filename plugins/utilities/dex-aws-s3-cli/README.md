# dex-aws-s3-cli

CLI-утилита для AWS S3. Read-only диагностика бакетов и объектов через [`aws s3`](https://docs.aws.amazon.com/cli/latest/reference/s3/) / `aws s3api`.

## Команды

| Команда | Описание |
|---------|----------|
| `/s3-ls` | Список бакетов аккаунта или содержимое префикса (опц. `--recursive`) |
| `/s3-info` | Конфигурация бакета: регион, encryption, versioning, lifecycle, public access |
| `/s3-head` | Метаданные одного объекта: size, content-type, ETag, KMS, version |
| `/s3-presign` | Сгенерировать временный URL для скачивания приватного объекта |

## Требования

- [AWS CLI v2](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) (`aws`) в `PATH`
- Параметры доступа: `~/.aws/credentials` / `~/.aws/config` или env (`AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_SESSION_TOKEN` / `AWS_PROFILE` / `AWS_REGION`)

## Установка CLI

```bash
# Linux (Debian/Ubuntu)
sudo apt install awscli

# Linux (Fedora/RHEL)
sudo dnf install awscli

# macOS
brew install awscli

# Универсально (рекомендовано AWS) — bundled installer
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o /tmp/awscliv2.zip
unzip /tmp/awscliv2.zip -d /tmp && sudo /tmp/aws/install

# One-shot installer (авто-детект ОС)
./install-bundle/install-cli-tools.sh aws
```

После установки — настройка профиля:

```bash
aws configure                  # дефолтный профиль
aws configure --profile prod   # дополнительный профиль
aws sts get-caller-identity    # проверить, кто вы сейчас
```

Полный гайд (multi-profile, SSO, IAM Roles Anywhere, временные креды через `aws sso login`) и матрица CLI vs MCP — см. [docs/CLI_UTILITIES.md](../../../docs/CLI_UTILITIES.md).

## Установка плагина

```bash
claude plugins install dex-aws-s3-cli@dex-claude-marketplace
```

## Безопасность

- Все команды **read-only**. Запись (`cp`, `sync`, `mv`), удаление (`rm`, `rb`), создание (`mb`) намеренно **не** обёрнуты в slash-команды — выполняются вручную.
- `/s3-presign` создаёт URL, действующий до 7 дней — обращаться с ним как с секретом: не публиковать в чатах/тикетах/логах.
- Для прода используйте read-only IAM политику (`s3:Get*`, `s3:List*` и `kms:Decrypt` для KMS-зашифрованных бакетов) — это durable safety-граница.
- Cross-account доступ настраивайте через assume-role профили в `~/.aws/config`, не передавайте ключи в env.
