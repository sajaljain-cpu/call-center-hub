FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY app.html server.cjs ./
EXPOSE 3001
CMD ["node", "server.cjs"]
