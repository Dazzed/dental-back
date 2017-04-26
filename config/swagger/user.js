const paths = {
  '/api/v1/accounts/signup': {
    'x-swagger-router-controller': 'auth',
    post: {
      tags: ['User'],
      description: 'register a new user',
      operationId: 'signup',
      parameters: [
        {
          name: 'user',
          in: 'body',
          description: 'the new user object',
          required: true,
          schema: { $ref: '#/definitions/SignupRequest' }
        }
      ],
      produces: ['application/json'],
      responses: {
        200: {
          description: 'Success',
          schema: { $ref: '#/definitions/SignupResponse' }
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
  SignupRequest: {
    type: 'object',
    required: [
      'email',
      'firstName',
      'lastName',
      'password',
      'confirmPassword',
      'confirmEmail',
      'origin'
    ],
    properties: {
      email: { type: 'string' },
      firstName: { type: 'string' },
      lastName: { type: 'string' },
      password: { type: 'string', format: 'password' },
      confirmPassword: { type: 'string', format: 'password' },
      confirmEmail: { type: 'string' },
      origin: {
        type: 'string',
        enum: [
          'external',
          'internal'
        ]
      },
    }
  },
  SignupResponse: {
    required: [
      'data'
    ],
    properties: {
      data: {
        $ref: '#/definitions/UserObject'
      }
    }
  },
  UserObject: {
    properties: {
      id: { type: 'integer' },
      officeName: { type: 'string' },
      url: { type: 'string' },
      email: { type: 'string' },
      phone: { type: 'string' },
      message: { type: 'string' },
      address: { type: 'string' },
      city: { type: 'string' },
      state: { type: 'string' },
      zipCode: { type: 'string' },
      acceptsChildren: { type: 'boolean' },
      childStartingAge: { type: 'integer' },
      logo: { type: 'string' },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
      childMembershipId: { type: 'integer' },
      workingHours: {
        type: 'array',
        items: {
          $ref: '#/definitions/WorkingHoursObject'
        }
      },
      membership: {
        $ref: '#/definitions/MembershipObject'
      },
      childMembership: {
        $ref: '#/definitions/MembershipObject'
      },
      officeImages: {
        type: 'array',
        items: {
          $ref: '#/definitions/DentistPhotoInfoObject'
        }
      }
    }
  },
  WorkingHoursObject: {
    required: [
      'id',
      'day'
    ],
    properties: {
      id: { type: 'integer' },
      day: {
        type: 'string',
        enum: [
          'sunday',
          'monday',
          'tuesday',
          'wednesday',
          'thursday',
          'friday',
          'saturday',
          'sundary'
        ]
      },
      isOpen: { type: 'boolean' },
      startAt: { type: 'string', format: 'date-time' },
      endAt: { type: 'string', format: 'date-time' },
      dentistInfoId: { type: 'integer' },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' }
    }
  },
  MembershipObject: {
    required: [
      'id',
      'name',
      'price',
      'withDiscount',
      'monthly',
      'yearly',
      'adultYearlyFeeActivated',
      'childYearlyFeeActivated'
    ],
    properties: {
      id: { type: 'integer' },
      name: { type: 'string' },
      price: { type: 'string' },
      monthly: { type: 'string' },
      yearly: { type: 'string' },
      withDiscount: { type: 'string' },
      description: { type: 'string' },
      activationCode: { type: 'string' },
      discount: { type: 'string' },
      recommendedFee: { type: 'boolean' },
      isActive: { type: 'boolean' },
      adultYearlyFeeActivated: { type: 'boolean' },
      childYearlyFeeActivated: { type: 'boolean' },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' }
    }
  },
  DentistPhotoInfoObject: {
    required: [
      'id',
      'url',
      'createdAt',
      'dentistInfoId'
    ],
    properties: {
      id: { type: 'integer' },
      url: { type: 'string' },
      createdAt: { type: 'string', format: 'date-time' },
      dentistInfoId: { type: 'integer' }
    }
  },
};

export default {
  paths,
  definitions,
};
