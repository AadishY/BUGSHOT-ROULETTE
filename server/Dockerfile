# Production Dockerfile for Aadish-Roulette Server
FROM node:18-slim

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package*.json ./
RUN npm install --production

# Bundle app source
COPY . .

# Expose port
EXPOSE 7860

# Production environment
ENV NODE_ENV=production

# Run the server
CMD [ "node", "index.js" ]
