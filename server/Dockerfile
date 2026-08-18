FROM node:20-alpine
WORKDIR /app

# Ставим python и yt-dlp
RUN apk add --no-cache python3 py3-pip
RUN pip install --no-cache-dir --break-system-packages yt-dlp

COPY package*.json ./
RUN npm install
COPY . .
RUN npx prisma generate

COPY entrypoint.sh /app/entrypoint.sh

# На случай, если entrypoint.sh тоже сохранён с Windows-переносами строк (\r\n):
RUN tr -d '\r' < /app/entrypoint.sh > /app/entrypoint.sh.tmp && mv /app/entrypoint.sh.tmp /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

EXPOSE 5000

# Продовый режим по умолчанию (миграции из файлов).
# docker-compose.override.yml на Windows полностью переопределяет
# entrypoint/command инлайн-строкой — никакого отдельного dev-скрипта
# в файловой системе больше нет, поэтому проблем с кодировкой файла
# на Windows тоже больше не будет.
ENTRYPOINT ["/app/entrypoint.sh"]