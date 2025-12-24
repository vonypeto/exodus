FROM node:22.20-alpine AS base

WORKDIR /home/node/app

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN npm install -g corepack@latest

COPY ./ ./

RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --prod

FROM node:22.20-alpine AS runner

COPY --from=base /home/node/app /home/node/app

WORKDIR /home/node/app

EXPOSE 80

CMD ["node", "src/main.js", "--mode", "app"]