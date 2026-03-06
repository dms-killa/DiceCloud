FROM node:14-bullseye

USER root
RUN adduser --system mt

USER mt

RUN curl https://install.meteor.com/?release=2.14 | sh

WORKDIR /home/mt
RUN git clone https://github.com/dms-killa/DiceCloud dicecloud
WORKDIR /home/mt/dicecloud/app

ENV PATH=$PATH:/home/mt/.meteor
RUN meteor npm install
RUN meteor build --directory ~/dc/ --architecture os.linux.x86_64

WORKDIR /home/mt/dc/bundle/programs/server
RUN npm install
WORKDIR /home/mt/dc/bundle
RUN rm -r /home/mt/dicecloud

ENTRYPOINT node main.js
