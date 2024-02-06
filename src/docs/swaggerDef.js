const { version } = require('../../package.json')
const config = require('../config/config')

const swaggerDef = {
  openapi: '3.0.0',
  info: {
    title: 'WayFinder API documentation',
    version
  },
  servers: [
    {
      url: `http://20.83.172.169/fide_dev/v1/api/`
    }
  ]
}

module.exports = swaggerDef
