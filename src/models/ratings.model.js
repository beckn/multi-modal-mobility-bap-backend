const Ratings = (sequelize, DataTypes) => {
  const ratings = sequelize.define(
    'feedback',
    {

      routeId: {
        type: DataTypes.STRING,
        allowNull: false
      },
      rating: {
        type: DataTypes.STRING,
        default: '0'
      },
      feedback: {
        type: DataTypes.JSON,
        allowNull: true
      },
      comments: {
        type: DataTypes.STRING,
        allowNull: true
      },
      feedBackScreenDisplayed: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
      },
      skip: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
      }
    },
    {
      timestamps: true
    }
  )

  return ratings
}

module.exports = Ratings
