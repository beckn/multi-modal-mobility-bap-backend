const winston = require('winston')
require('winston-daily-rotate-file')
const root = require('app-root-path')
const config = require('./config')

const { combine, timestamp, printf } = winston.format
const logLevel = config.log.level

const logFile = `${root.path}/logs/`

const logFormat = printf((detail) => `${detail.timestamp} ${detail.level} : ${detail.message}\n`)

const loggerTransports = []
if (config.enableLoggingToConsole) {
  loggerTransports.push(
    new winston.transports.Console({
      level: logLevel,
      handleExceptions: true,
      json: false,
      colorize: true
    })
  )
}

if (config.enableLoggingToFile) {
  const filetransport = new (winston.transports.DailyRotateFile)({
    filename: `${logFile + config.log.file}-%DATE%.log`,
    datePattern: 'YYYY-MM-DD',
    zippedArchive: false,
    maxSize: config.log.max_size,
    maxFiles: config.log.max_retention_days
  })
  loggerTransports.push(filetransport)
}

const logger = winston.createLogger({
  level: logLevel,
  format: combine(timestamp(), logFormat),
  transports: loggerTransports
})

const edrloggerTransports = []

const edrfiletransport = new (winston.transports.DailyRotateFile)({
  filename: `${logFile}edrs/${config.log.file}-edr-%DATE%.log`,
  datePattern: 'YYYY-MM-DD',
  zippedArchive: false,
  maxSize: config.log.max_size,
  maxFiles: config.log.max_retention_days
})
edrloggerTransports.push(edrfiletransport)

const edrLogger = winston.createLogger({
  level: logLevel,
  format: combine(timestamp(), logFormat),
  transports: edrloggerTransports
})

module.exports = {
  logger,
  edrLogger
}
module.exports.stream = {
  write (message, encoding) {
    logger.info(message.substring(0, message.lastIndexOf('\n')))
  }
}
