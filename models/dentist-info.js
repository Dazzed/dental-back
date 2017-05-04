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
    }
  }, {
    tableName: 'dentistInfos',
    classMethods: {
      associate(models) {
        DentistInfo.hasMany(models.DentistInfoService, {
          // through: 'dentistInfoService',
          foreignKey: 'dentistInfoId',
          as: 'services'
        });

        DentistInfo.belongsTo(models.Membership, {
          foreignKey: 'membershipId',
          as: 'membership'
        });

        DentistInfo.belongsTo(models.Membership, {
          foreignKey: 'childMembershipId',
          as: 'childMembership'
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

        DentistInfo.belongsTo(models.User, {
          foreignKey: 'userId',
          as: 'user'
        });
      }
    }
  });

  return DentistInfo;
}
