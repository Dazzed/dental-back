import HTTPStatus from 'http-status';

// const isProd = process.env.NODE_ENV !== 'development';

// TODO: Hide error stacks in prod

export class ForbiddenError extends Error {
  constructor(message = 'Forbidden') {
    super(message);
    this.statusCode = HTTPStatus.FORBIDDEN;
  }
}


export class BadRequestError extends Error {
  constructor(errors, message = 'Bad Request') {
    super(message);
    this.statusCode = HTTPStatus.BAD_REQUEST;
    this.errors = errors;
  }
}


export class NotFoundError extends Error {
  constructor(message = 'Not Found') {
    super(message);
    this.statusCode = HTTPStatus.NOT_FOUND;
  }
}


export class UnauthorizedError extends Error {
  constructor(message = 'Unauthorized Access') {
    super(message);
    this.statusCode = HTTPStatus.UNAUTHORIZED;
  }
}
