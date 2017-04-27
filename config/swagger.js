module.exports = (host) => ({
  swagger: '2.0',
  info: {
    version: '1.0.0',
    title: 'DentalHQ API Docs'
  },
  host,
  basePath: '/',
  schemes: ['http'],
  consumes: ['application/json'],
  produces: ['application/json'],
  paths: {
    // #region LOGIN
    '/api/v1/accounts/login': {
      'x-swagger-router-controller': 'auth',
      post: {
        description: 'attempt to login to api',
        operationId: 'login',
        parameters: [
          {
            name: 'credentials',
            in: 'body',
            description: 'the users credentials',
            required: true,
            schema: { $ref: '#/definitions/LoginSchema' }
          }
        ],
        produces: ['application/json'],
        responses: {
          200: {
            description: 'Success',
            schema: { $ref: '#/definitions/LoginResponse' }
          },
          default: {
            description: 'Bad Request',
            schema: { $ref: '#/definitions/ErrorResponse' }
          }
        }
      },
    },
    // #endregion
    '/swagger': {}
  },
  definitions: {
    // #region LOGIN
    LoginSchema: {
      type: 'object',
      required: [
        'email',
        'password'
      ],
      properties: {
        email: { type: 'string' },
        password: { type: 'string' }
      }
    },
    LoginResponse: {
      required: [
        'type',
        'token'
      ],
      properties: {
        type: { type: 'string' },
        token: { type: 'string' }
      }
    },
    ErrorResponse: {
      required: [
        'meta'
      ],
      properties: {
        errors: { type: 'string' },
        meta: { $ref: '#/definitions/ErrorMetaResponse' }
      }
    },
    ErrorMetaResponse: {
      type: 'object',
      required: [
        'code',
        'stack',
        'message'
      ],
      properties: {
        code: { type: 'number' },
        stack: { type: 'string' },
        message: { type: 'string' }
      }
    }
    // #endregion
  }
});