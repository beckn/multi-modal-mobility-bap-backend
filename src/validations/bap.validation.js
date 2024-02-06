const Joi = require('joi')

const search = {
  body: Joi.object().keys({
    start: Joi.string().required(),
    end: Joi.string().required(),
    type: Joi.string()
  })
}

const select = {
  body: Joi.object().keys({
    routeId: Joi.string().required(),
    routeType: Joi.string()
  }).unknown()
}

module.exports = {
  search,
  select
}
