const egg = require('egg');

egg
  .start({
    workers: 1,
    port: 3000,
    mode: 'single',
  })
  .then((app) => {
    app.listen(3000);
    console.log('listen 3000');
  })
  .catch((err) => {
    console.error(err);
  });
