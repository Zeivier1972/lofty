# PROBE build: downloads the Zoom Meeting SDK and prints the header
# signatures we code against into the build log. Replaced by the real bot.
FROM ubuntu:24.04
ARG ZOOM_SDK_URL
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates xz-utils && rm -rf /var/lib/apt/lists/*
WORKDIR /sdk
RUN test -n "$ZOOM_SDK_URL" && curl -fsSL -o sdk.tar.xz "$ZOOM_SDK_URL" && tar -xJf sdk.tar.xz && rm sdk.tar.xz && find . -maxdepth 3 | head -80
RUN H=$(dirname $(find . -name zoom_sdk.h | head -1)); echo "HDIR=$H"; \
    for f in meeting_service_components/meeting_chat_interface.h meeting_service_interface.h auth_service_interface.h meeting_service_components/meeting_participants_ctrl_interface.h; do \
      echo "===== $f"; grep -nE "virtual|^class|^enum|^struct|SDK_CHAT|SDKChatMessageType|^\s+[A-Z_]+[,=]" "$H/$f" | sed 's/^\s*//' ; done
CMD ["sleep", "infinity"]
