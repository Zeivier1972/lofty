# Sofía — native Zoom Meeting SDK bot + Node control server.
# The SDK is not in the repo (Zoom license): it is downloaded at build time
# from ZOOM_SDK_URL (a Railway variable on this service).
FROM ubuntu:24.04
ARG ZOOM_SDK_URL
ARG DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
      build-essential cmake pkgconf curl ca-certificates xz-utils \
      libglib2.0-dev libssl-dev libdbus-1-3 libgbm1 libgl1 libegl1 libglib2.0-0 \
      libx11-6 libx11-xcb1 libxcb1 libxcb-image0 libxcb-keysyms1 libxcb-randr0 libxcb-shape0 \
      libxcb-shm0 libxcb-xfixes0 libxcb-xtest0 libxcb-xinerama0 libxcb-icccm4 libxcb-render-util0 \
      libxcb-cursor0 libxkbcommon0 libxkbcommon-x11-0 libxfixes3 libxrandr2 libxdamage1 libxcomposite1 \
      libxtst6 libxi6 libxrender1 libnss3 libfontconfig1 libfreetype6 libgl1-mesa-dri \
      libasound2t64 pulseaudio pulseaudio-utils dbus \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
RUN test -n "$ZOOM_SDK_URL" \
    && curl -fsSL -o /tmp/sdk.tar.xz "$ZOOM_SDK_URL" \
    && mkdir -p sdk && tar -xJf /tmp/sdk.tar.xz -C sdk && rm /tmp/sdk.tar.xz \
    && cp sdk/libmeetingsdk.so sdk/libmeetingsdk.so.1

COPY CMakeLists.txt ./
COPY src ./src
RUN cmake -B build -S . && cmake --build build -j"$(nproc)" && test -x build/sofia-bot \
    && (ldd build/sofia-bot | grep "not found" || echo "all libraries found")

COPY server.mjs entry.sh ./
RUN chmod +x entry.sh
ENV SOFIA_BOT_BIN=/app/build/sofia-bot \
    LD_LIBRARY_PATH=/app/sdk:/app/sdk/qt_libs/Qt/lib \
    QT_QPA_PLATFORM=offscreen
CMD ["./entry.sh"]
