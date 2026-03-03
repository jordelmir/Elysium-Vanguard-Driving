# Dockerfile para Servicio de Backend Elysium Vanguard
# Basado en Node.js para servicios de orquestación y tiempo real.

FROM node:20-alpine

# Instalar dependencias necesarias para Prisma y Postgres
RUN apk add --no-cache openssl

WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./
COPY prisma ./prisma/

# Instalar dependencias de producción
RUN npm install --only=production

# Guardar los cambios de Prisma
RUN npx prisma generate

# Copiar el resto del código
COPY . .

# Exponer el puerto para WebSockets / API
EXPOSE 3000

# Comando para iniciar el servicio de orquestación
CMD ["npm", "start"]
