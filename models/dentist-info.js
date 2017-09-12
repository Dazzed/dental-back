// ────────────────────────────────────────────────────────────────────────────────
// MODULES

import { instance, model } from '../orm-methods/dentist-info';

// ────────────────────────────────────────────────────────────────────────────────

export default function (sequelize, DataTypes) {
  const DentistInfo = sequelize.define('DentistInfo', {
    officeName: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: '',
    },
    url: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: '',
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: '',
    },
    phone: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: '',
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: '',
    },
    address: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: '',
    },
    city: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: '',
    },
    state: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: '',
    },
    zipCode: {
      type: DataTypes.STRING,
      defaultValue: '',
    },
    acceptsChildren: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },
    childStartingAge: {
      type: DataTypes.INTEGER
    },
    logo: {
      type: DataTypes.STRING
    },
    marketplaceOptIn: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    affordabilityScore: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    managerId: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    officeSlug: {
      type: DataTypes.STRING
    }
  }, {
    tableName: 'dentistInfos',
    instanceMethods: instance,
    classMethods: Object.assign({
      associate(models) {

        DentistInfo.hasMany(models.DentistInfoService, {
          foreignKey: 'dentistInfoId',
          as: 'services'
        });

        DentistInfo.hasMany(models.WorkingHours, {
          foreignKey: 'dentistInfoId',
          as: 'workingHours'
        });

        DentistInfo.hasMany(models.MembershipItem, {
          foreignKey: 'dentistInfoId',
          as: 'pricing'
        });

        DentistInfo.hasMany(models.DentistInfoPhotos, {
          foreignKey: 'dentistInfoId',
          as: 'officeImages'
        });

        DentistInfo.hasMany(models.Membership, {
          foreignKey: 'dentistInfoId',
          as: 'memberships'
        });

        // DentistInfo.hasMany(models.Membership, {
        //   foreignKey: 'dentistInfoId',
        //   as: 'childMembership'
        // });

        DentistInfo.belongsTo(models.User, {
          foreignKey: 'userId',
          as: 'user'
        });
      }
    }, model)
  });

  return DentistInfo;
}
