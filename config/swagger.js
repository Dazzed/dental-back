import auth from './swagger/auth';
import user from './swagger/user';
import dentist from './swagger/dentist';

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
    dentist.paths,
    user.paths,
    {
      '/swagger': {}
    }
  ),
  parameters: Object.assign({},
    dentist.parameters
  ),
  definitions: Object.assign({},
    auth.definitions,
    dentist.definitions,
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
