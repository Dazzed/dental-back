FROM node:7.5

RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

COPY . /usr/src/app/
EXPOSE 3000
RUN npm install
RUN npm install -g sequelize-cli
CMD [ "npm", "run", "dev" ]
