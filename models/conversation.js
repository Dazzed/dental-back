export default function (sequelize, DataTypes) {
  const Conversation = sequelize.define('Conversation', {
  }, {
    tableName: 'conversations',
    classMethods: {
      associate(models) {
        Conversation.belongsTo(models.User, {
          foreignKey: 'clientId',
          as: 'client',
        });

        Conversation.belongsTo(models.User, {
          foreignKey: 'dentistId',
          as: 'dentist',
        });

        Conversation.hasMany(models.Message, {
          foreignKey: 'conversationId',
          as: 'messages',
        });
      }
    }
  });

  return Conversation;
}

