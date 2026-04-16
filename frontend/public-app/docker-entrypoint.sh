#!/bin/sh
# Replace API URL in built JS files
if [ -n "$VITE_API_URL" ]; then
  find /usr/share/nginx/html/assets -name '*.js' -exec sed -i "s|http://localhost:5000|${VITE_API_URL}|g" {} +
  echo "Replaced API URL with: $VITE_API_URL"
fi
# Set PORT (Railway provides PORT env var)
export PORT="${PORT:-80}"
envsubst '${PORT}' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf
echo "Nginx listening on port $PORT"
exec "$@"
