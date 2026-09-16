FROM oven/bun:1-slim

# Install OpenSSL for Prisma
RUN apt-get update -y && apt-get install -y openssl

# Create app directory
WORKDIR /usr/src/app

# Copy package files
COPY package.json bun.lockb* ./

# Install app dependencies using bun
RUN bun install

# Copy Prisma schema and generate client
# COPY prisma ./prisma/
# RUN bunx prisma generate

# Copy the rest of the application source code
COPY . .

# Build the TypeScript code (if you still want to compile to dist)
# Note: Since you're using bun, you can also run the TS files directly!
# RUN bun run build

# Expose the port the app runs on
EXPOSE 5000

# Start the application using bun
# If you prefer running the compiled code: CMD ["bun", "run", "start"]
# If you prefer running the TS code directly: CMD ["bun", "src/server.ts"]
CMD ["bun", "run", "start"]
