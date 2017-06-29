// ────────────────────────────────────────────────────────────────────────────────
// MODULES

import './services/passport';
import v1 from './controllers/v1';
import {
  BaseAppError,
  BadRequestError
} from './controllers/errors';
import HTTPStatus from 'http-status';
// ────────────────────────────────────────────────────────────────────────────────

module.exports = (app) => {
  app.use((req, res, next) => {
    req.locals = {};  // eslint-disable-line no-param-reassign
    next();
  });

  app.use('/api/v1', v1);

  app.use((err, req, res, next) => {
    if(err instanceof BaseAppError) {
      err.sendResponse(res);
      return next();
    } else {
      console.log(err);
      if (app.get('env') === 'development' || app.get('env') === 'test') {
        res.status(HTTPStatus.INTERNAL_SERVER_ERROR);
        res.json(err);
        res.send();
      } else {
        res.status(HTTPStatus.INTERNAL_SERVER_ERROR);
        res.send();
      }
      return next();
    }
  });

};
