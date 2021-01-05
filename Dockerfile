# Stage 1 : Build
# From latest node version
FROM bearstech/node-dev:14 as builder

# Declare args
ARG REVISION
ARG RELEASE_TAG
ENV YARN_VERSION=1.22.4

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
FROM bearstech/node:14

# image-spec annotations using labels
# https://github.com/opencontainers/image-spec/blob/master/annotations.md
LABEL org.opencontainers.image.source="https://github.com/papey/trostani"
LABEL org.opencontainers.image.revision=${GIT_COMMIT_SHA}
LABEL org.opencontainers.image.version=${RELEASE_TAG}
LABEL org.opencontainers.image.authors="Wilfried OLLIVIER"
LABEL org.opencontainers.image.title="trostani"
LABEL org.opencontainers.image.description="trostani runtime"
LABEL org.opencontainers.image.licences="Unlicense"

RUN useradd -ms /bin/bash trostani

RUN mkdir /opt/trostani

WORKDIR /opt/trostani

COPY --from=builder /opt/trostani/dist ./dist
COPY --from=builder /opt/trostani/package.json .
RUN npm install --only=production

USER trostani

# setup default args
CMD ["/opt/trostani/dist/main.js"]

# setup entrypoint command
ENTRYPOINT ["node"]
