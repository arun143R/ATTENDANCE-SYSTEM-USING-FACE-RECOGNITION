FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000
ENV ADMIN_USER=admin
ENV ADMIN_PASS=admin123

CMD ["npm", "start"]
