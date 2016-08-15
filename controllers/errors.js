import HTTPStatus from 'http-status';


export class ForbiddenError extends Error {
  constructor(message) {
    super(message);
    this.statusCode = HTTPStatus.FORBIDDEN;
  }
}


export class BadRequestError extends Error {
  constructor(errors, message) {
    super(message);
    this.statusCode = HTTPStatus.BAD_REQUEST;
    this.errors = errors;
  }
}


export class NotFoundError extends Error {
  constructor(message) {
    super(message);
    this.statusCode = HTTPStatus.NOT_FOUND;
  }
}
