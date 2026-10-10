# Plattformen (app.bolagsappar.se) för Railway och andra Docker-värdar.
# Railway använder den här filen automatiskt. Hemsidan har en egen: deploy/web.Dockerfile.
# Utan VITE_SUPABASE_URL och VITE_SUPABASE_ANON_KEY körs plattformen i demoläge med påhittad data.

FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN corepack enable
COPY . .
# Bara plattformen och paketen den behöver (inte mobilappen eller hemsidan)
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
