import passportLocalSequelize from 'passport-local-sequelize';
import { SEX_TYPES, PREFERRED_CONTACT_METHODS } from '../config/constants';


export default function (sequelize, DataTypes) {
  const User = sequelize.define(
    'users',
    Object.assign(
      passportLocalSequelize.defaultUserSchema,
      {
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
          allowNull: false,
        },
        email: {
          type: DataTypes.STRING,
          unique: true,
          allowNull: false,
          validate: { isEmail: true, notEmpty: true }
        },
        phone: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        hash: {
          type: new DataTypes.STRING(1024),
          allowNull: false
        },
        avatar: {
          type: DataTypes.JSON,
          allowNull: true
        },
        address: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        city: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        state: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        zipCode: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        sex: {
          type: new DataTypes.ENUM(Object.keys(SEX_TYPES)),
          allowNull: false
        },
        contactMethod: {
          type: new DataTypes.ENUM(Object.keys(PREFERRED_CONTACT_METHODS)),
          allowNull: false
        },
        accountHolder: {
          type: DataTypes.BOOLEAN,
          defaultValue: false,
        }
      }
    ), {
      classMethods: {
        associate() {
          // create associations
        }
      }
    }
  );

  passportLocalSequelize.attachToUser(User, {
    userExistsError: 'User already exists with username "%s"',
    usernameField: 'email',
    // activationRequired: true,
    usernameLowerCase: true
  });

  return User;
}
