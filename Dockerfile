FROM node:10.19.0

WORKDIR /app

ENV PATH=$PATH:/app/node_modules/.bin

COPY ./package.json /app/package.json
COPY ./package-lock.json /app/package-lock.json

RUN npm install

COPY . /app
