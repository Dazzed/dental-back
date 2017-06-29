// ────────────────────────────────────────────────────────────────────────────────
// MODULES

import HTTPStatus from 'http-status';

// ────────────────────────────────────────────────────────────────────────────────
// EXPORTS

export const BaseAppError = function(statusCode = HTTPStatus.INTERNAL_SERVER_ERROR, message = 'Internal Server Error', errors = null) {
  if(!Error.captureStackTrace)
    this.stack = (new Error()).stack;
  else
    Error.captureStackTrace(this, this.constructor);
  this.statusCode = statusCode;
  this.message = message;
  this.errors = errors;
}

BaseAppError.prototype = new Error();
BaseAppError.prototype.name = 'BaseAppError';
BaseAppError.prototype.constructor = BaseAppError;

BaseAppError.prototype.sendResponse = function(res) {
  res.status(this.statusCode);
  res.json({
    message: this.message,
    errors: this.errors
  });
};

BaseAppError.prototype.getErrors = function() {
  return this.errors;
}

BaseAppError.prototype.getStatusCode = function() {
  return this.statusCode;
}

function createBaseAppErrorType(name, init, statusCode, message) {
  function E() {
    init && init.apply(this, arguments);
  }
  E.prototype = new BaseAppError(statusCode, message);
  E.prototype.name = name;
  E.prototype.constructor = E;
  return E;
}


export const BadRequestError = createBaseAppErrorType('BadRequestError', function(errors) {
  this.errors = errors;
}, HTTPStatus.BAD_REQUEST, 'Bad Request');

export const ForbiddenError = createBaseAppErrorType('ForbiddenError', function() {}, HTTPStatus.FORBIDDEN, 'Forbidden');

export const NotFoundError = createBaseAppErrorType('NotFoundError', function() {}, HTTPStatus.NOT_FOUND, 'Not found');

export const UnauthorizedError = createBaseAppErrorType('UnauthorizedError', function() {}, HTTPStatus.UNAUTHORIZED, 'Unauthorized');