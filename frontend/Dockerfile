# Servicio "web": compila React con Node y lo sirve con Nginx, que reenvía /api al servicio "api".
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Siempre contra el backend real: los datos ficticios (MSW) quedan apagados
ENV VITE_ENABLE_API_MOCKING=false
RUN npm run build

FROM nginx:1.27-alpine
# La imagen oficial pasa los *.template por envsubst al arrancar (solo variables definidas).
# NGINX_ENTRYPOINT_LOCAL_RESOLVERS toma el DNS del contenedor (Docker o Railway) para resolver API_UPSTREAM.
ENV PORT=8080 \
    API_UPSTREAM=http://api:8000 \
    NGINX_ENTRYPOINT_LOCAL_RESOLVERS=1
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
