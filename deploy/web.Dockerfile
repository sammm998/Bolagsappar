# Hemsidan (bolagsappar.se). I Railway: sätt variabeln RAILWAY_DOCKERFILE_PATH=deploy/web.Dockerfile på den tjänsten.
FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile --filter "@bolagsappar/web..."
ARG PUBLIC_SUPABASE_URL=""
ARG PUBLIC_SUPABASE_ANON_KEY=""
ARG PUBLIC_APP_URL="https://app.bolagsappar.se"
ENV PUBLIC_SUPABASE_URL=$PUBLIC_SUPABASE_URL PUBLIC_SUPABASE_ANON_KEY=$PUBLIC_SUPABASE_ANON_KEY PUBLIC_APP_URL=$PUBLIC_APP_URL
RUN pnpm --filter @bolagsappar/web build

FROM caddy:2.10-alpine
COPY deploy/Caddyfile.static /etc/caddy/Caddyfile
COPY --from=build /app/apps/web/dist /srv
ENV PORT=8080
EXPOSE 8080
