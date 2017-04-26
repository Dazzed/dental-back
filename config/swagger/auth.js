const paths = {
  '/api/v1/accounts/login': {
    'x-swagger-router-controller': 'auth',
    post: {
      tags: ['Authorization'],
      description: 'attempt to login to api',
      operationId: 'login',
      parameters: [
        {
          name: 'credentials',
          in: 'body',
          description: 'the users credentials',
          required: true,
          schema: { $ref: '#/definitions/LoginRequest' }
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
  '/api/v1/accounts/logout': {
    'x-swagger-router-controller': 'auth',
    get: {
      tags: ['Authorization'],
      description: 'attempt to logout of the current user session',
      operationId: 'logout',
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
    }
  },
};

const definitions = {
  LoginRequest: {
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
};

export default {
  paths,
  definitions
};
