FROM node:20-alpine AS base

WORKDIR /app

COPY package*.json ./
COPY tsconfig.json ./
COPY prisma ./prisma

RUN npm ci
RUN npx prisma generate

COPY . . 

RUN npm run build

FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY tsconfig.json ./
COPY prisma ./prisma

RUN npm ci --omit=dev
RUN npx prisma generate

COPY --from=base /app/dist ./dist

EXPOSE 3000

CMD ["node", "dist/index.js"]