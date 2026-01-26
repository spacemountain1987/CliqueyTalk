# Use the official Node.js 20 image.
FROM node:20

# Set the working directory inside the container
WORKDIR /usr/src/app

# Update package lists and install FFmpeg
RUN apt-get update && apt-get install -y ffmpeg

# Copy package.json and package-lock.json to leverage Docker cache
COPY package*.json ./

# Install application dependencies
RUN npm install

# Copy the rest of the application's source code
COPY . .

# The Next.js application will be started by App Hosting's default run command,
# so we don't need a CMD or ENTRYPOINT.
