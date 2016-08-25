require('dotenv').config();
require('babel-register');

// Load dotenv if needed
const fs = require('fs');
const path = require('path');

const rootDir = path.normalize(path.join(__dirname, '.'));

// Test if dot env exists.
if (fs.existsSync(path.join(rootDir, '.env'))) {
  require('dotenv').load();  // eslint-disable-line global-require
}

const isDeveloment = process.env.NODE_ENV !== 'production';


// Main starting point of the application
const express = require('express');
const http = require('http');
const bodyParser = require('body-parser');
const morgan = require('morgan');
const router = require('./router');
const expressValidator = require('express-validator');
const validators = require('./utils/express-validators');
const mailer = require('express-mailer');
const nunjucks = require('nunjucks');

const app = express();

// require models
require('./models');

// App Setup
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(isDeveloment ? 'dev' : 'combined'));
}

let mailerOptions = { transportMethod: 'Stub' };

if (process.env.NODE_ENV === 'production') {
  mailerOptions = {
    transportMethod: 'SendGrid',
    auth: {
      user: process.env.SENDGRID_USERNAME,
      pass: process.env.SENDGRID_PASSWORD,
    }
  };
}

mailer.extend(app, mailerOptions);

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'html');

nunjucks.configure('views', {
  autoescape: true,
  express: app,
});

app.use(bodyParser.json({ type: '*/*' }));

app.use(expressValidator({
  customValidators: {
    isDBUnique: validators.isDBUnique,
    existsInDB: validators.existsInDB,
  },
}));

router(app);

if (require.main === module) {
  // Server Setup
  const port = process.env.PORT || 3090;
  const server = http.createServer(app);
  server.listen(port);
  console.log('Server listening on: ', port);
} else {
  module.exports = app;
}
