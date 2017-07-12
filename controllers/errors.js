// ────────────────────────────────────────────────────────────────────────────────
// MODULES

import HTTPStatus from 'http-status';

// ────────────────────────────────────────────────────────────────────────────────
// EXPORTS

export class ForbiddenError extends Error {
  constructor(message = 'Forbidden') {
    super(message);
    this.message = message;
    this.statusCode = HTTPStatus.FORBIDDEN;
  }
}

export class BadRequestError extends Error {
  constructor(message = 'Bad Request', errors = null) {
    super(message);
    this.statusCode = HTTPStatus.BAD_REQUEST;
    this.message = message;
    if (!(process.env.NODE_ENV === 'production')) {
      this.errors = errors;
      delete this.meta;
    }
  }
}

export class NotFoundError extends Error {
  constructor(message = 'Not Found') {
    super(message);
    this.statusCode = HTTPStatus.NOT_FOUND;
    this.message = message;
  }
}

export class UnauthorizedError extends Error {
  constructor(message = 'Unauthorized Access') {
    super(message);
    this.message = message;
    this.statusCode = HTTPStatus.UNAUTHORIZED;
  }
}
