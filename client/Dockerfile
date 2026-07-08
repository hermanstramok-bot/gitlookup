FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY client/ ./client/
WORKDIR /app/client
RUN npx vite build

FROM nginx:alpine
COPY --from=build /app/client/dist /usr/share/nginx/html
COPY client/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80