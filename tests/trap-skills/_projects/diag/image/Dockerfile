# Образ лаборатории диагностики (группа 4.6, #307): Debian 12 aarch64, .NET SDK 8.0, инструменты отладки и профилирования.
# Сборка идёт с сетью, прогон - без сети (--network none). Версии инструментов печатает tools-versions.sh.
FROM mcr.microsoft.com/dotnet/sdk:8.0
ENV DEBIAN_FRONTEND=noninteractive DOTNET_CLI_TELEMETRY_OPTOUT=1 DOTNET_NOLOGO=1 DOTNET_SKIP_FIRST_TIME_EXPERIENCE=1
RUN apt-get update && apt-get install -y --no-install-recommends \
      gdb lldb strace linux-perf binutils binutils-multiarch gcc g++ gcc-x86-64-linux-gnu libc6-dev make util-linux \
      valgrind bpftrace bpfcc-tools procps psmisc file git ca-certificates python3 python3-pip curl xz-utils \
      libicu72 libssl3 \
 && rm -rf /var/lib/apt/lists/*
RUN git clone --depth 1 https://github.com/brendangregg/FlameGraph /opt/FlameGraph
ENV DOTNET_ROOT=/usr/share/dotnet PATH=/root/.dotnet/tools:/opt/FlameGraph:$PATH
RUN dotnet tool install -g dotnet-dump && dotnet tool install -g dotnet-trace && dotnet tool install -g dotnet-counters \
 && dotnet tool install -g dotnet-gcdump && dotnet tool install -g dotnet-symbol && dotnet tool install -g dotnet-sos \
 && dotnet tool install -g ilspycmd --version 9.1.0.7988
RUN dotnet-sos install
RUN pip3 install --break-system-packages lief
RUN curl -fsSL -o /tmp/ncdbg.tgz https://github.com/Samsung/netcoredbg/releases/download/3.1.0-1031/netcoredbg-linux-arm64.tar.gz \
 && tar -xzf /tmp/ncdbg.tgz -C /opt && ln -s /opt/netcoredbg/netcoredbg /usr/local/bin/netcoredbg && rm /tmp/ncdbg.tgz
COPY tools-versions.sh /usr/local/bin/tools-versions.sh
WORKDIR /work
