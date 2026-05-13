FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY server.cjs app.html supabase_setup.sql ./
EXPOSE 3001
CMD ["node", "server.cjs"]
