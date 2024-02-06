const axios = require('axios')
const QRCode = require('qrcode')
const crypto = require('crypto')
const appRoot = require('app-root-path')
const fs = require('fs')
const AWS = require('aws-sdk')
const mustache = require('mustache')
const { logger } = require('../config/logger')
const { GOOGLE_MAPS_KEY, AWS_SMS_CREDS, OTP_SMS_TEMPLATE, COUNTRY_CODE } = require('../config/config')

AWS.config.update({
  credentials: {
    accessKeyId: AWS_SMS_CREDS.accessKeyId,
    secretAccessKey: AWS_SMS_CREDS.secretAccessKey
  },
  region: AWS_SMS_CREDS.region
})

const getDistanceMatrix = async (origins, destinations, mode = null) => {
  if (!mode) { mode = 'driving' }
  const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origins}&destinations=${destinations}&key=${GOOGLE_MAPS_KEY}&mode=${mode}`

  let result = null
  const response = await axios.get(url)

  if (response.status !== 200) {
    return null
  }
  result = {
    distance: response.data.rows[0].elements[0].distance.text,
    duration: response.data.rows[0].elements[0].duration.text,
    destination: response.data.destination_addresses[0],
    origin: response.data.origin_addresses[0]
  }
  return result
}

const generateQR = async (payload) => {
  const tempFile = crypto.randomBytes(16).toString('hex') + '.png'

  const imagePath = `${appRoot}/public/qrcodes/${tempFile}`

  QRCode.toDataURL(payload.token, function (err, url) {
    if (!err) {
      const base64Image = url.split(';base64,').pop()
      fs.writeFile(imagePath, base64Image, { encoding: 'base64' }, function (err) {
        if (err) { logger.error('Failed creating file') } else { logger.info('File created') }
      })
    }
  })
  return tempFile
}

const sendTextMessage = async (otp, mobileNo) => {
  mobileNo = COUNTRY_CODE + mobileNo
  // Create publish parameters
  const message = mustache.render(OTP_SMS_TEMPLATE, { otp })
  const params = {
    Message: message, /* required */
    PhoneNumber: mobileNo
  }

  // Create promise and SNS service object
  const publishTextPromise = new AWS.SNS({ apiVersion: '2010-03-31' }).publish(params).promise()

  // Handle promise's fulfilled/rejected states
  publishTextPromise.then(
    function (data) {
      return 1
    }).catch(
    function (err) {
      console.error(err, err.stack)
      return 0
    })
  return 1
}

module.exports = {
  getDistanceMatrix,
  generateQR,
  sendTextMessage
}
