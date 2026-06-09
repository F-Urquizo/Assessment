FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
# npm install (not ci) so a stale lock file doesn't block the build while
# new deps (prisma) are being added. Re-lock locally with `npm install`.
RUN npm install

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Generate Prisma Client before compiling TypeScript so @prisma/client types
# are available during nest build.
RUN npx prisma generate
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/prisma ./prisma
COPY package*.json ./
EXPOSE 3000
CMD ["npm", "run", "start:docker"]
