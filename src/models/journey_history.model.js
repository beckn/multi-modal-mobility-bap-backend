const Journey_history = (sequelize, DataTypes) => {
  const journeys = sequelize.define(
    'journey_history',
    {

      routeId: {
        type: DataTypes.STRING,
        allowNull: false
      },

      type: {
        type: DataTypes.ENUM,
        values: ['AUTO', 'BUS', 'MULTI'],
        defaultValue: 'AUTO',
        allowNull: false
      },
      status: {
        type: DataTypes.ENUM,
        values: ['SELECTED', 'IN_PROGRESS', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'FAILED'],
        defaultValue: 'CONFIRMED',
        allowNull: false
      },
      details: {
        type: DataTypes.JSON
      }
    },
    {
      timestamps: true
    }
  )

  return journeys
}

module.exports = Journey_history
