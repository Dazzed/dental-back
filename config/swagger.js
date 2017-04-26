import auth from './swagger/auth';
import user from './swagger/user';

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
  paths: Object.assign({},
    auth.paths,
    user.paths,
    {
      '/swagger': {}
    }
  ),
  definitions: Object.assign({},
    auth.definitions,
    user.definitions,
    {
      ErrorResponse: {
        required: [
          'meta'
        ],
        properties: {
          errors: { type: 'string' },
          meta: {
            $ref: '#/definitions/ErrorMetaResponse'
          }
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
    }
  )
});
