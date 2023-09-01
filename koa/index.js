const Koa = require('koa');
const logger = require('koa-logger');
const router = require('@koa/router')();

const app = new Koa();

// middlewares

app.use(logger());

const helloWorld = (ctx) => {
  ctx.body = 'Hello World!!!';
};

router.get('/', helloWorld);

app.use(router.routes());

app.listen(3000);
