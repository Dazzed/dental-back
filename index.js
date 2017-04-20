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
const aws = require('aws-sdk');

const app = express();

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,PATCH,POST,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', '*');
      // 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, ' +
      // 'Content-Length, Content-MD5, Content-Type, Date');
  res.header('Access-Control-Allow-Credentials', true);
  next();
});

// require models
require('./models');
require('csv-express');

// App Setup
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(isDeveloment ? 'dev' : 'combined'));
}

aws.config.update({
  secretAccessKey: process.env.S3_ACCESS_KEY,
  accessKeyId: process.env.S3_ACCESS_KEY_ID,
  region: process.env.S3_REGION,
});

app.use('/s3', require('react-s3-uploader/s3router')({
  bucket: process.env.S3_BUCKET,
  region: process.env.S3_REGION,
  signatureVersion: 'v4',
  headers: { 'Access-Control-Allow-Origin': '*' },
  ACL: 'public-read',
  uniquePrefix: true,
}));

let mailerOptions = { transportMethod: 'Stub' };

if (process.env.NODE_ENV === 'production') {
  mailerOptions = {
    transportMethod: 'SendGrid',
    from: 'Dental Marketplace <donotreply@dental-marketplace.com>',
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

app.use(bodyParser.json({ limit: '4mb' }));
app.use(bodyParser.urlencoded({ limit: '4mb', extended: true }));

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
