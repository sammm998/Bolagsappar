# Plattformen ensam (app.bolagsappar.se) när hemsidan körs som egen tjänst.
# I Railway: RAILWAY_DOCKERFILE_PATH=deploy/platform.Dockerfile på den tjänsten.
FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile --filter "@bolagsappar/platform..."
ARG VITE_SUPABASE_URL=""
ARG VITE_SUPABASE_ANON_KEY=""
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
RUN pnpm --filter @bolagsappar/platform build

FROM caddy:2.10-alpine
COPY deploy/Caddyfile.spa /etc/caddy/Caddyfile
COPY --from=build /app/apps/platform/dist /srv
ENV PORT=8080
EXPOSE 8080
