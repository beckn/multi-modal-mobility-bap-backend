const httpStatus = require('http-status')
const jobService = require('./job.service')
const historyService = require('./history.service')

const { edrLogger, logger } = require('../config/logger')
const { defaultModeType } = require('../config/config')
const amnexservice = require('./amnex_bpp.service')
const nammayatriservice = require('./nammayatri_bpp.service')
const ApiError = require('../utils/ApiError')

const dayjs = require('dayjs')
const timezone = require('dayjs/plugin/timezone')
const utc = require('dayjs/plugin/utc')
const NodeCache = require('node-cache')
const reqCache = new NodeCache()

dayjs.extend(utc)

dayjs.extend(timezone)
dayjs.tz.setDefault('Asia/Kolkata')

const getAllModals = async (user, payload) => {
  // Add to job
  // historyService.deleteOldTransaction(user);

  payload.type = defaultModeType

  const jobData = {
    userId: user.id,
    input: payload
  }
  logger.info('Request for search : ' + JSON.stringify(payload))
  const job = await jobService.createJob(jobData)

  // Get list of transports

  getCollatedRoutes(job, payload, user)
  return job
}

const getCollatedRoutes = async (job, payload, user) => {
  const jobId = job.id
  const createdDateTime = dayjs.tz(job.updatedAt)
  if (payload.type == 'AUTO') {
    const autoDetails = await nammayatriservice.getListOfAutosAvailable(payload)

    if (autoDetails.error) {
      jobService.updateJobById(jobId, { status: 'FAILED', response: autoDetails.errorDetails })
      edrLogger.info(JSON.stringify({ message: 'Request to search ', state: 'SEARCH', user: user.id, request: payload, jobId: job.id, responseTime: dayjs.tz(dayjs()).diff(createdDateTime, 's') }))
      return
    }

    jobService.updateJobById(jobId, { status: 'COMPLETED', response: autoDetails.details })
    for (const element of autoDetails.details) {
      historyService.addRide(user, element, element.routeId, element.type, 'SEARCH')
    }
  } else if (payload.type == 'BUS') {
    const busDetails = await amnexservice.getListOfBusesAvailable(payload, user)
    if (busDetails.error) {
      jobService.updateJobById(jobId, { status: 'FAILED', response: busDetails.errorDetails })
      edrLogger.info(JSON.stringify({ message: 'Request to search ', state: 'SEARCH', user: user.id, request: payload, jobId: job.id, responseTime: dayjs.tz(dayjs()).diff(createdDateTime, 's') }))
      return
    }
    jobService.updateJobById(jobId, { status: 'COMPLETED', response: busDetails })
    edrLogger.info(JSON.stringify({ message: 'Request to search ', state: 'SEARCH', user: user.id, request: payload, jobId: job.id, responseTime: dayjs.tz(dayjs()).diff(createdDateTime, 's') }))
  } else {
    const autoDetails = await nammayatriservice.getListOfAutosAvailable(payload)

    if ((autoDetails) && (autoDetails.error)) {
      jobService.updateJobById(jobId, { status: 'FAILED', response: autoDetails.errorDetails })
      edrLogger.info(JSON.stringify({ message: 'Request to search ', state: 'SEARCH', user: user.id, request: payload, jobId: job.id, responseTime: dayjs.tz(dayjs()).diff(createdDateTime, 's') }))
    }
    for (const auto of autoDetails.details) {
      historyService.addRide(user, auto, auto.routeId, auto.type, 'SEARCH')
    }
    const busDetails = await amnexservice.getListOfBusesAvailable(payload, user)
    if (busDetails.error) {
      jobService.updateJobById(jobId, { status: 'FAILED', response: busDetails.errorDetails })
      edrLogger.info(JSON.stringify({ message: 'Request to search ', state: 'SEARCH', user: user.id, request: payload, jobId: job.id, responseTime: dayjs.tz(dayjs()).diff(createdDateTime, 's') }))
      return
    }

    const routes = [...autoDetails.details, ...busDetails]
    jobService.updateJobById(job.id, { status: 'COMPLETED', response: routes })
    edrLogger.info(JSON.stringify({ message: 'Request to search ', state: 'SEARCH', user: user.id, request: payload, responseTime: dayjs.tz(dayjs()).diff(createdDateTime, 's') }))
  }
}

const selectRide = async (user, payload) => {
  // Select auto
  const createdDateTime = dayjs()
  let routeDetails = await historyService.getRideById(payload.routeId)
  if (!routeDetails || routeDetails.length == 0) { throw new ApiError(httpStatus.NOT_FOUND, 'Route details not found') }

  routeDetails = routeDetails[0]
  let selectedRide
  if (routeDetails.type == 'MULTI') {
    selectedRide = []
    for (let i = 0; i < routeDetails.details.length; i++) {
      routeDetails.details[i].step = i + 1
      if (routeDetails.details[i].type == 'AUTO') {
        const responseFromAuto = await nammayatriservice.selectAutoRide(user, routeDetails.details[i], routeDetails.routeId, routeDetails.type)
        if (responseFromAuto) { selectedRide.push(responseFromAuto) }
      } else {
        const responseFromBus = await amnexservice.selectBusRide(routeDetails.details[i], routeDetails.routeId, routeDetails.type)
        if (responseFromBus) { selectedRide.push(responseFromBus) }
      }
    }
  } else if (routeDetails.type == 'AUTO') {
    selectedRide = await nammayatriservice.selectAutoRide(user, routeDetails.details, routeDetails.routeId, routeDetails.type)
  } else {
    selectedRide = await amnexservice.selectBusRide(routeDetails.details, routeDetails.routeId, routeDetails.type)
  }
  if (!selectedRide) {

  }
  selectedRide.feedBack = 0
  historyService.addRide(user, selectedRide, routeDetails.routeId, routeDetails.type, 'SELECTED')
  edrLogger.info(JSON.stringify({ message: 'Select a route', state: 'SELECT', user: user.id, type: routeDetails.type, responseTime: dayjs().diff(createdDateTime, 's') }))

  historyService.updateFeedback(user, { routeId: routeDetails.routeId, feedBackScreenDisplayed: 0 })
  return selectedRide
}

const confirmRide = async (user, payload) => {
  logger.warn('recieved confirm req ' + JSON.stringify(payload))
  const createdDateTime = dayjs.tz(dayjs())
  let selectedRide = null
  /* let routeDetails = await historyService.getRideById(payload.routeId, 'SELECTED')
  if (!routeDetails || routeDetails.length == 0) { throw new ApiError(httpStatus.NOT_FOUND, 'Route details not found') }
*/
  let ridedetails
  let routeDetails = await historyService.getRideById(payload.routeId, null)
  if (!routeDetails || routeDetails.length == 0) { throw new ApiError(httpStatus.NOT_FOUND, 'Route details not found') }

  logger.info('route details ' + JSON.stringify(routeDetails))
  for (let i = 0; i < routeDetails.length; i++) {
    if (routeDetails[i].status == 'SELECTED') { ridedetails = routeDetails[i] }
    if (routeDetails[i].status == 'COMPLETED' || routeDetails[i].status == 'CONFIRMED' || routeDetails[i].status == 'IN_PROGRESS' || routeDetails[i].status == 'CANCELLED') {
      if (routeDetails[i].details.id == payload.id) { return routeDetails[i] }
    }
  }
  routeDetails = ridedetails
  let multiModeDetails
  if (routeDetails.type == 'MULTI') {
    for (let i = 0; i < routeDetails.details.length; i++) {
      if (routeDetails.details[i].type == payload.type && routeDetails.details[i].id == payload.id) {
        if (reqCache.get(user.id + '_' + routeDetails.routeId + '_' + routeDetails.details[i].id)) {
          return []
        } else {
          reqCache.set(user.id + '_' + routeDetails.routeId + '_' + routeDetails.details[i].id, 1)
        }
        if (routeDetails.details[i].type == 'AUTO') {
          selectedRide = await nammayatriservice.confirmAutoRide(user, routeDetails.details[i])
        } else {
          selectedRide = await amnexservice.confirmBusRide(user, routeDetails.details[i])
        }
      }
    }
  } else if (routeDetails.type == 'AUTO') {
    selectedRide = await nammayatriservice.confirmAutoRide(user, routeDetails.details)
  } else {
    selectedRide = await amnexservice.confirmBusRide(user, routeDetails.details)
  }

  let historyData

  if (selectedRide.type == 'AUTO') {
    historyData = {
      id: selectedRide.id,
      type: selectedRide.type,
      orderId: selectedRide.order_id,
      price: selectedRide.price.value + ' ' + selectedRide.price.currency,
      start: selectedRide.fulfillment.start.location,
      end: selectedRide.fulfillment.end.location,
      vehicleDetails: selectedRide.fulfillment.vehicle,
      distance: selectedRide.distance,
      duration: selectedRide.duration,
      gps: selectedRide.gps,
      step: selectedRide.step
    }
  } else {
    historyData = {
      id: selectedRide.id,
      type: selectedRide.type,
      orderId: selectedRide.order_id,
      price: parseFloat(selectedRide.price.price.value).toFixed(2) + ' ' + selectedRide.price.price.currency,

      start: selectedRide.fulfillment.start.location,
      end: selectedRide.fulfillment.end.location,
      vehicleDetails: selectedRide.fulfillment.vehicle,
      qrImage: selectedRide.qr,
      distance: selectedRide.distance,
      duration: selectedRide.duration,
      gps: selectedRide.gps,
      startTime: selectedRide.startTime,
      endTime: selectedRide.endTime,
      distanceFromStartPoint: selectedRide.distanceFromStartPoint,
      durationFromStartPoint: selectedRide.durationFromStartPoint,
      endPointAddress: selectedRide.endPointAddress,
      startPointAddress: selectedRide.startPointAddress,
      distanceToEndPoint: selectedRide.distanceToEndPoint,
      durationToEndPoint: selectedRide.durationToEndPoint,
      step: selectedRide.step
    }
  }

  historyService.addHistory(user, historyData, payload.routeId, payload.routeType, 'CONFIRMED')

  historyService.addRide(user, selectedRide, payload.routeId, payload.routeType, 'CONFIRMED')
  edrLogger.info(JSON.stringify({ message: 'Confirming ride', state: 'CONFIRM', type: payload.type, user: user.id, routeId: payload.routeId, orderId: selectedRide.order_id, transactionId: selectedRide.payment.params.transaction_id, responseTime: dayjs.tz(dayjs()).diff(createdDateTime, 's') }))
  reqCache.del(user.id + '_' + routeDetails.routeId + '_' + selectRide.id)
  return selectedRide
}

module.exports = {
  getAllModals,
  selectRide,
  confirmRide
}
