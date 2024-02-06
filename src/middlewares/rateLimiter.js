const rateLimit = require('express-rate-limit')

const authLimiter = rateLimit({
  windowMs: 2 * 60 * 1000,
  max: 3,
  skipSuccessfulRequests: true
})

module.exports = {
  authLimiter
}
