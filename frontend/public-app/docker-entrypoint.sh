#!/bin/sh
# Replace API URL in built JS files
if [ -n "$VITE_API_URL" ]; then
  find /usr/share/nginx/html/assets -name '*.js' -exec sed -i "s|http://localhost:5000|${VITE_API_URL}|g" {} +
  echo "Replaced API URL with: $VITE_API_URL"
fi
# Set PORT (Railway provides PORT env var)
export PORT="${PORT:-80}"
# nginx 1.23+ uses http.d/, older versions use conf.d/
if [ -d /etc/nginx/http.d ]; then
  CONF_OUT="/etc/nginx/http.d/default.conf"
else
  CONF_OUT="/etc/nginx/conf.d/default.conf"
fi
envsubst '${PORT}' < /etc/nginx/conf.d/default.conf.template > "$CONF_OUT"
echo "Nginx listening on port $PORT"
exec "$@"
