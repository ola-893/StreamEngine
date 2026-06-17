FROM node:20-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
# The build output goes to /app/dist
RUN npm run build

FROM nginx:alpine
# Copy the built React app to nginx
COPY --from=builder /app/dist /usr/share/nginx/html
# Copy custom nginx configuration for SPA and proxy
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
