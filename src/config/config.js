const dotenv = require('dotenv')
const path = require('path')
const Joi = require('joi')

dotenv.config({ path: path.join(__dirname, '../../.env') })

const envVarsSchema = Joi.object()
  .keys({
    NODE_ENV: Joi.string().valid('production', 'development', 'demo', 'test').required(),
    PORT: Joi.number().default(3000),
    CLIENT_URL: Joi.string().default('localhost:3000'),
    JWT_SECRET: Joi.string().required().description('JWT secret key'),
    JWT_ACCESS_EXPIRATION_MINUTES: Joi.number().default(30).description('minutes after which access tokens expire'),
    JWT_REFRESH_EXPIRATION_DAYS: Joi.number().default(30).description('days after which refresh tokens expire'),
    SMTP_HOST: Joi.string().description('server that will send the emails'),
    SMTP_PORT: Joi.number().description('port to connect to the email server'),
    SMTP_USERNAME: Joi.string().description('username for email server'),
    SMTP_PASSWORD: Joi.string().description('password for email server'),
    EMAIL_FROM: Joi.string().description('the from field in the emails sent by the app'),

    POSTGRES_URL: Joi.string().description('Postgres DB url'),
    POSTGRES_URL_TEST: Joi.string().description('Postgres DB test url')
  })
  .unknown()

const { value: envVars, error } = envVarsSchema.prefs({ errors: { label: 'key' } }).validate(process.env)

if (error) {
  throw new Error(`Config validation error: ${error.message}`)
}

module.exports = {
  env: envVars.NODE_ENV,
  port: envVars.PORT,
  corsOrigin: envVars.NODE_ENV === 'production' ? envVars.CLIENT_URL : '*',
  clientURL: envVars.NODE_ENV === 'production' ? envVars.CLIENT_URL : 'localhost:3000',

  /* To be used if DB is Postgres */
  postgres: {
    url: envVars.NODE_ENV === 'test' ? envVars.POSTGRES_URL_TEST : envVars.POSTGRES_URL,
    options: {
      useCreateIndex: true,
      useNewUrlParser: true,
      useUnifiedTopology: true
    }
  },
  jwt: {
    secret: envVars.JWT_SECRET,
    accessExpirationMinutes: envVars.JWT_ACCESS_EXPIRATION_MINUTES,
    refreshExpirationDays: envVars.JWT_REFRESH_EXPIRATION_DAYS,
    resetPasswordExpirationMinutes: 10,
    userVerificationExpirationMins: 30
  },

  log: {
    level: envVars.LOG_LEVEL || 'debug',
    file: envVars.LOG_FILE_NAME || 'fide-service-api',
    max_size: envVars.MAX_SIZE || '1G',
    max_retention_days: envVars.MAX_RETENTION_DAYS || '180d'
  },
  enableLoggingToFile: 1,
  enableLoggingToConsole: 1,

  dbToBeUsed: 'postgres',
  otpLength: 6,
  bapClientUrl: 'http://localhost:5003',

  amnex_mobilityConfig: {
    country: 'IND',
    domain: 'nic2004:60221',
    bap_id: 'shwetha-bap-test',
    city: 'std:080',
    core_version: '0.9.4',
    bap_uri: 'http://20.83.172.169/bap_network/',
    action: 'search',
    bpp_id: 'nasik-beckn-api.amnex.com',
    bpp_uri: 'https://nasik-beckn-api.amnex.com/api/BPP'
  },

  nammaYatri_mobilityConfig: {
    country: 'IND',
    domain: 'mobility:ridehailing:0.8.0',
    bap_id: 'shwetha-bap-test',
    city: 'std:080',
    core_version: '0.9.4',
    action: 'search',
    bap_uri: 'http://20.83.172.169/bap_network/'
  },

  server_url: 'http://20.83.172.169/fide_dev/',
  GOOGLE_MAPS_KEY: envVars.GOOGLE_MAPS_KEY,
  COUNTRY_CODE: '+91',
  RESEND_COUNT: 3,
  NORESEND_WINDOW: 2, // in mins
  CUSTOMER_SUPPORT_PHONE_NUMBER: '12345677',
  AUTO_BOOKING_MIN_DISTANCE: 5, // in km

  // For sending OTP
  AWS_SMS_CREDS: {
    accessKeyId: envVars.AWS_SMS_ACCESSKEY,
    secretAccessKey: envVars.AWS_SMS_SECRETKEY,
    region: envVars.AWS_SMS_REGION
  },
  OTP_SMS_TEMPLATE: 'Use OTP {{otp}} to log into your Wayfinder account. Do not share the OTP with anyone. - Wayfinder',

  // To update user rides status
  USER_IDLE_TIME: 60, // in mins
  defaultModeType: 'BUS'
}
