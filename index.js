require('babel-register');

// Load dotenv if needed
const fs = require('fs');
const path = require('path');

const rootDir = path.normalize(path.join(__dirname, '/..'));

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

const app = express();

// require models
require('./models');

// App Setup
app.use(morgan(isDeveloment ? 'dev' : 'combined'));
app.use(bodyParser.json({ type: '*/*' }));
router(app);

// Server Setup
const port = process.env.PORT || 3090;
const server = http.createServer(app);
server.listen(port);
console.log('Server listening on: ', port);
