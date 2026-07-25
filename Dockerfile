FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --production

COPY . .
RUN mkdir -p data

EXPOSE 6066

CMD ["node", "server.js"]
