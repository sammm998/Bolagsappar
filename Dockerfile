# En tjänst för Railway: hemsidan på / och plattformen på /app.
# Railway använder den här filen automatiskt. Med egna domäner kan hemsidan och plattformen även köras
# som två tjänster (deploy/web.Dockerfile och deploy/platform.Dockerfile).
# Utan VITE_SUPABASE_URL och VITE_SUPABASE_ANON_KEY körs plattformen i demoläge med påhittad data.

FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile --filter "@bolagsappar/platform..." --filter "@bolagsappar/web..."
ARG VITE_SUPABASE_URL=""
ARG VITE_SUPABASE_ANON_KEY=""
ARG PUBLIC_SUPABASE_URL=""
ARG PUBLIC_SUPABASE_ANON_KEY=""
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY \
    PUBLIC_SUPABASE_URL=$PUBLIC_SUPABASE_URL PUBLIC_SUPABASE_ANON_KEY=$PUBLIC_SUPABASE_ANON_KEY
RUN VITE_BASE=/app/ pnpm --filter @bolagsappar/platform build
RUN PUBLIC_APP_URL=/app pnpm --filter @bolagsappar/web build

FROM caddy:2.10-alpine
COPY deploy/Caddyfile.combined /etc/caddy/Caddyfile
COPY --from=build /app/apps/web/dist /srv/web
COPY --from=build /app/apps/platform/dist /srv/app
ENV PORT=8080
EXPOSE 8080
