FROM node:20-alpine
WORKDIR /app

# Ставим python и yt-dlp
RUN apk add --no-cache python3 py3-pip
RUN pip install --no-cache-dir --break-system-packages yt-dlp

COPY package*.json ./
RUN npm install
COPY . .
RUN npx prisma generate
EXPOSE 5000
CMD ["node", "index.js"]