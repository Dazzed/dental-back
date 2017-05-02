const paths = {
  '/api/v1/dentists/{userId}': {
    parameters: [
      { $ref: '#/parameters/userId' }
    ]
  },
};

const parameters = {
  userId: {
    name: 'userId',
    in: 'path',
    type: 'integer',
    required: true
  }
};

const definitions = {};

export default {
  paths,
  parameters,
  definitions,
};
