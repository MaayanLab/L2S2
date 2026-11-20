FROM node:22
WORKDIR /app
ENV NODE_ENV=production
ADD package.json .
ADD package-lock.json .
RUN npm i --include=dev
ADD . .
RUN npm run build && rm .env
CMD ["npm", "start"]