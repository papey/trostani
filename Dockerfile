# Stage 1 : Build
# From latest node version
FROM node:lts-bullseye AS builder

RUN apt-get update -y \
	&& apt-get upgrade -y

ENV YARN_VERSION=1.22.22

# Create src dir
RUN mkdir /opt/trostani

# Set working directory
WORKDIR /opt/trostani

# Deps first, optimizing layers
COPY package.json .

# Download all the world in node_modules
RUN yarn

# Then code
COPY . .

# From ts to js
RUN yarn build

# Stage 2 : run !
FROM node:lts-bullseye

RUN apt-get update -y \
	&& apt-get upgrade -y


RUN useradd -ms /bin/bash trostani

RUN mkdir /opt/trostani

WORKDIR /opt/trostani

COPY --from=builder /opt/trostani/dist ./dist
COPY --from=builder /opt/trostani/package.json .
RUN npm install --only=production --legacy-peer-deps

USER trostani

# setup default args
CMD ["/opt/trostani/dist/main.js"]

# setup entrypoint command
ENTRYPOINT ["node"]
