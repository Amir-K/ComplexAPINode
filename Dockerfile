FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY .yalc/ .yalc/

# Install dependencies
RUN npm i

# Copy built files
COPY dist ./dist

# Expose the port the app runs on
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
