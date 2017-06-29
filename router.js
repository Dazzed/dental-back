// ────────────────────────────────────────────────────────────────────────────────
// MODULES

import './services/passport';
import v1 from './controllers/v1';

// ────────────────────────────────────────────────────────────────────────────────

module.exports = (app) => {
  app.use((req, res, next) => {
    req.locals = {};  // eslint-disable-line no-param-reassign
    next();
  });

  app.use('/api/v1', v1);

  /* eslint-disable no-unused-vars */
  if (app.get('env') === 'development' || app.get('env') === 'test') {
    app.use((err, req, res, next) => {
      res.status(err.statusCode || 500);
      res.json({
        errors: err.errors,
        meta: {
          code: err.statusCode,
          stack: err.stack,
          message: err.message,
        },
      });
    });
  }

  // production error handler
  // no stacktraces leaked to user
  app.use((err, req, res, next) => {
    res.status(err.statusCode || 500);
    res.json({
      errors: err.errors,
      meta: {
        code: err.statusCode,
        message: err.message,
      },
    });
  });
};
