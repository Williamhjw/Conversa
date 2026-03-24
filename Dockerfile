FROM node:20-alpine
WORKDIR /app

# Copy package files
COPY backend/package*.json ./
RUN npm install --omit=dev

# Copy all backend files
COPY backend/ .

# Create uploads directory
RUN mkdir -p uploads

# Expose the port Render expects
EXPOSE 10000

# Start the app
CMD ["node", "index.js"]