import passportLocalSequelize from 'passport-local-sequelize';
import {
  SEX_TYPES,
  PREFERRED_CONTACT_METHODS,
  USER_TYPES,
} from '../config/constants';

export const EXCLUDE_FIELDS_LIST = ['tos', 'hash', 'avatar', 'salt',
  'activationKey', 'resetPasswordKey', 'verified', 'createdAt', 'updatedAt',
  'phone', 'address', 'isDeleted'];


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
      allowNull: false,
      validate: { isEmail: true, notEmpty: true }
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
    accountHolder: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    isDeleted: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    type: {
      type: new DataTypes.ENUM(Object.keys(USER_TYPES)),
      allowNull: false,
      defaultValue: 'client',
    }
  }, {
    tableName: 'users',
    classMethods: {
      associate(models) {
        // Phone numbers relationship
        User.hasMany(models.Phone, {
          foreignKey: 'userId',
          as: 'phoneNumbers',
          allowNull: true
        });

        // Addresses relationship
        User.hasMany(models.Address, {
          foreignKey: 'userId',
          as: 'addresses',
          allowNull: true
        });

        // FamilyMember relationship
        User.hasMany(models.FamilyMember, {
          foreignKey: 'userId',
          as: 'familyMembers',
          allowNull: true
        });

        // Membership relationship
        User.hasMany(models.Membership, {
          foreignKey: 'userId',
          as: 'memberships',
          allowNull: true
        });

        // subscription relationship
        User.hasMany(models.Subscription, {
          foreignKey: 'dentistId',
          as: 'dentistSubscriptions',
        });

        User.hasMany(models.Subscription, {
          foreignKey: 'clientId',
          as: 'clientSubscriptions',
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
          allowNull: true
        });

        User.hasOne(models.DentistInfo, {
          foreignKey: 'userId',
          as: 'dentistInfo',
        });
      },

      getActiveUser(id) {
        return User.findById(id, {
          attributes: {
            exclude: EXCLUDE_FIELDS_LIST,
          },
          where: { isDeleted: false, verified: true },
          include: [
            { model: User.sequelize.models.Address, as: 'addresses' },
            { model: User.sequelize.models.Phone, as: 'phoneNumbers' },
            {
              model: User.sequelize.models.DentistSpecialty,
              as: 'dentistSpecialty'
            },
          ],
        });
      }
    }
  });

  passportLocalSequelize.attachToUser(User, {
    userExistsError: 'User already exists with email "%s"',
    usernameField: 'email',
    activationRequired: true,
    usernameLowerCase: true
  });

  return User;
}
