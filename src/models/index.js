const Sequelize = require('sequelize')
const config = require('../config/config')
const user = require('./user.model')
const job = require('./jobs.model')
const token = require('./token.model')
const journey_history = require('./journey_history.model')
const rides = require('./rides.model')
const feedback = require('./ratings.model')

let sequelize
if (config.dbToBeUsed === 'mysql') {
// connecting to  mysql
  sequelize = new Sequelize(config.mysql_config.DB, config.mysql_config.USER, config.mysql_config.PASSWORD, {
    host: config.mysql_config.HOST,
    dialect: config.mysql_config.dialect,
    operatorsAliases: 0,

    pool: {
      max: config.mysql_config.pool.max,
      min: config.mysql_config.pool.min,
      acquire: config.mysql_config.pool.acquire,
      idle: config.mysql_config.pool.idle
    }
  })
} else if (config.dbToBeUsed === 'postgres') {
  sequelize = new Sequelize(config.postgres.url, {
    dialect: 'postgres',
    ssl: false
  })
}

const models = {
  User: user(sequelize, Sequelize),
  Token: token(sequelize, Sequelize),
  Job: job(sequelize, Sequelize),
  Journey_history: journey_history(sequelize, Sequelize),
  Rides: rides(sequelize, Sequelize),
  Feedback: feedback(sequelize, Sequelize)
}

models.Token.belongsTo(models.User)
models.Job.belongsTo(models.User)
models.Journey_history.belongsTo(models.User)
models.Rides.belongsTo(models.User)
models.Feedback.belongsTo(models.User)

Object.keys(models).forEach((key) => {
  if ('associate' in models[key]) {
    models[key].associate(models)
  }
})

module.exports = { sequelize, models }
