#!/usr/bin/env bash
# The Meeting SDK expects a sound server even when it never joins audio.
mkdir -p /var/run/dbus
[ -f /var/lib/dbus/machine-id ] || dbus-uuidgen > /var/lib/dbus/machine-id
dbus-daemon --config-file=/usr/share/dbus-1/system.conf --fork >/dev/null 2>&1 || true
rm -rf /var/run/pulse /var/lib/pulse /root/.config/pulse
mkdir -p /root/.config/pulse
pulseaudio -D --exit-idle-time=-1 --system --disallow-exit >/dev/null 2>&1 || true
pactl load-module module-null-sink sink_name=SpeakerOutput >/dev/null 2>&1 || true
pactl set-default-sink SpeakerOutput >/dev/null 2>&1 || true
pactl set-default-source SpeakerOutput.monitor >/dev/null 2>&1 || true
mkdir -p /root/.config && printf "[General]\nsystem.audio.type=default\n" > /root/.config/zoomus.conf
exec node /app/server.mjs
