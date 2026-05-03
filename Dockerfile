FROM node:20-slim

# Рабочая директория
WORKDIR /app

# Копируем package.json и устанавливаем зависимости
COPY package*.json ./
RUN npm ci --only=production

# Копируем собранный код
COPY dist ./dist

# Устанавливаем SSE-прокси для MCP
RUN npm install -g mcp-proxy

# Переменные окружения (будут переопределены в docker-compose)
ENV YAZIO_USERNAME=""
ENV YAZIO_PASSWORD=""
ENV PORT=3000

# Запуск через SSE-прокси
CMD ["mcp-proxy", "--port", "3000", "--", "node", "dist/index.js"]
