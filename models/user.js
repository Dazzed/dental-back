/* eslint max-len:0 */
import passportLocalSequelize from 'passport-local-sequelize';

import { instance, model } from '../orm-methods/users';

import {
  SEX_TYPES,
  PREFERRED_CONTACT_METHODS,
  USER_TYPES,
  MEMBER_RELATIONSHIP_TYPES,
  USER_ORIGIN_OPTIONS
} from '../config/constants';

export const EXCLUDE_FIELDS_LIST = ['tos', 'hash', 'salt',
  'activationKey', 'resetPasswordKey', 'verified', 'updatedAt',
  'phone', 'address', 'isDeleted', 'authorizeId', 'paymentId'];


export default function (sequelize, DataTypes) {
  const User = sequelize.define('User', {
    salt: {
      type: DataTypes.STRING,
      allowNull: false
    },
    activationKey: {
      type: DataTypes.STRING,
      allowNull: true
    },
    resetPasswordKey: {
      type: DataTypes.STRING,
      allowNull: true
    },
    verified: {
      type: DataTypes.BOOLEAN,
      allowNull: true
    },
    firstName: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: { notEmpty: true }
    },
    middleName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    lastName: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: { notEmpty: true }
    },
    birthDate: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    email: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: true,
      validate: { isEmail: true }
    },
    hash: {
      type: new DataTypes.STRING(1024),
      allowNull: false
    },
    avatar: {
      type: DataTypes.JSON,
      allowNull: true
    },
    city: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    state: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    zipCode: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    sex: {
      type: new DataTypes.ENUM(Object.keys(SEX_TYPES)),
      allowNull: true
    },
    contactMethod: {
      type: new DataTypes.ENUM(Object.keys(PREFERRED_CONTACT_METHODS)),
      allowNull: true
    },
    isDeleted: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    type: {
      type: new DataTypes.ENUM(Object.keys(USER_TYPES)),
      allowNull: false,
      defaultValue: 'client',
    },
    familyRelationship: {
      type: new DataTypes.ENUM(Object.keys(MEMBER_RELATIONSHIP_TYPES)),
      allowNull: true,
    },
    origin: {
      type: new DataTypes.ENUM(USER_ORIGIN_OPTIONS),
      allowNull: true,
      validate: { notEmpty: true }
    },
    cancellationFee: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },
    reEnrollmentFee: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },
    cancellationFeeWaiver: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },
    reEnrollmentFeeWaiver: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },
    termsAndConditions: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },
    waiverCreatedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    accountHolder: {
      type: DataTypes.VIRTUAL,
      get: function get() {
        return !!this.get('primaryPaymentProfile');
      }
    },
    addedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
    }
  }, {
    tableName: 'users',

    instanceMethods: instance,

    classMethods: Object.assign({
      associate(models) {
        // Phone numbers relationship
        User.hasMany(models.Phone, {
          foreignKey: 'userId',
          as: 'phoneNumbers',
          allowNull: true,
        });

        // Addresses relationship
        User.hasMany(models.Address, {
          foreignKey: 'userId',
          as: 'addresses',
          allowNull: true,
        });

        // FamilyMember relationship
        User.hasMany(User, {
          foreignKey: 'addedBy',
          as: 'members',
          allowNull: true,
        });

        // Membership relationship
        User.hasMany(models.Membership, {
          foreignKey: 'userId',
          as: 'memberships',
          allowNull: true,
        });

        // subscription relationship
        User.hasOne(models.Subscription, {
          foreignKey: 'dentistId',
          as: 'dentistSubscription',
        });

        User.hasOne(models.Subscription, {
          foreignKey: 'clientId',
          as: 'clientSubscription',
        });

        // reviews relationship
        User.hasMany(models.Review, {
          foreignKey: 'dentistId',
          as: 'dentistReviews',
        });

        User.hasMany(models.Review, {
          foreignKey: 'clientId',
          as: 'clientReviews',
        });

        User.belongsTo(models.DentistSpecialty, {
          foreignKey: 'dentistSpecialtyId',
          as: 'dentistSpecialty',
          allowNull: true,
        });

        User.hasOne(models.DentistInfo, {
          foreignKey: 'userId',
          as: 'dentistInfo',
        });

        // refunds relationship
        User.hasMany(models.Refunds, {
          foreignKey: 'userId',
          as: 'refunds',
          allowNull: true,
        });

        User.hasOne(models.PaymentProfile, {
          foreignKey: 'primaryAccountHolderId',
          as: 'primaryPaymentProfile',
          allowNull: true,
        });
      },

      getActiveUser(id, accountOwner) {
        const where = {
          id,
          isDeleted: false,
          verified: true,
        };

        if (accountOwner) {
          where.addedBy = accountOwner;
          delete where.verified;
        }

        return User.find({
          where,
          attributes: {
            exclude: EXCLUDE_FIELDS_LIST,
          },
          include: [{
            model: User.sequelize.models.Address,
            as: 'addresses',
          }, {
            model: User.sequelize.models.Phone,
            as: 'phoneNumbers',
          }, {
            model: User.sequelize.models.DentistSpecialty,
            as: 'dentistSpecialty',
          }, {
            attributes: ['name'],
            model: User.sequelize.models.Membership,
            as: 'memberships'
          }],
        });
      }
    }, model),
  });

  passportLocalSequelize.attachToUser(User, {
    userExistsError: 'User already exists with email "%s"',
    usernameField: 'email',
    activationRequired: true,
    usernameLowerCase: true
  });

  return User;
}
