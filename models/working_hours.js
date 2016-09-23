import { DAYS } from '../config/constants';

export default function (sequelize, DataTypes) {
  const WorkingHours = sequelize.define('WorkingHours', {
    day: {
      type: new DataTypes.ENUM(DAYS),
      allowNull: false
    },
    isOpen: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    startAt: {
      type: DataTypes.TIME,
      allowNull: true,
    },
    endAt: {
      type: DataTypes.TIME,
      allowNull: true,
    },
  }, {
    tableName: 'workingHours',
    classMethods: {
      associate(models) {
        WorkingHours.belongsTo(models.DentistInfo, {
          foreignKey: 'dentistInfoId',
          as: 'workingHours',
        });
      }
    }
  });

  return WorkingHours;
}

