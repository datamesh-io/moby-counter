FROM mhart/alpine-node:8
MAINTAINER Kai Davenport <kaiyadavenport@gmail.com>
ADD . /srv/app
WORKDIR /srv/app
RUN npm install
EXPOSE 80
ENTRYPOINT ["node", "index.js"]
