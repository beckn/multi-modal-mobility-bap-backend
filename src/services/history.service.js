const { models } = require('../models')

const { Journey_history, Rides, Feedback } = models
const dayjs = require('dayjs')
const ApiError = require('../utils/ApiError')
const httpStatus = require('http-status')
const timezone = require('dayjs/plugin/timezone')
const utc = require('dayjs/plugin/utc')
const { Op } = require('sequelize')
const { logger } = require('../config/logger')

const { USER_IDLE_TIME } = require('../config/config')

dayjs.extend(utc)

dayjs.extend(timezone)
dayjs.tz.setDefault('Asia/Kolkata')

const addHistory = async (user, payload, routeId, routeType, status) => {
  const historyData = await Journey_history.findAll({ where: { routeId }, raw: true })

  if (historyData && historyData.length > 0) {
    for (let i = 0; i < historyData.length; i++) {
      if (historyData[i].details.id == payload.id) {
        await Journey_history.destroy({
          where: {
            id: historyData[i].id
          }
        })
      }
    }
  }

  const historyPayload = {
    userId: user.id,
    details: payload,
    type: routeType,
    routeId,
    status
  }
  const history = await Journey_history.create(historyPayload)
  return history
}

const getHistoryByUser = async (id) => {
  const details = await Journey_history.findAll({ where: { userId: id }, order: [['updatedAt', 'DESC']], raw: true })
  const historyData = []
  const multiRoutes = []
  for (let i = 0; i < details.length; i++) {
    if (details[i].type == 'MULTI') {
      let totalCost = 0
      let totalDistance = 0
      let totalDuration = 0
      if (!multiRoutes.includes(details[i].routeId)) {
        multiRoutes.push(details[i].routeId)
        const multiDetails = await Journey_history.findAll({ where: { routeId: details[i].routeId }, raw: true })
        const det = []
        let endLocation
        let userGps
        if (multiDetails.length > 0) {
          const lastLeg = multiDetails.length - 1
          if (multiDetails[lastLeg].details.type == 'AUTO') { endLocation = multiDetails[lastLeg].details.end.address.ward } else if (multiDetails[lastLeg].details.type == 'BUS') {
            endLocation = multiDetails[lastLeg].details.end.descriptor.name
            userGps = multiDetails[lastLeg].details.gps
          }
        }
        for (let j = 0; j < multiDetails.length; j++) {
          const price = multiDetails[j].details.price.split(' ')[0]
          totalCost = totalCost + Number(price)
          if (multiDetails[j].details.duration) {
            totalDuration = totalDuration + Number(multiDetails[j].details.duration.split(' ')[0])
            totalDistance = totalDistance + Number(multiDetails[j].details.distance.split(' ')[0])
          }
          multiDetails[j].details.status = multiDetails[j].status
          userGps = multiDetails[j].details.gps
          det.push(multiDetails[j].details)
        }
        multiDetails[0].totalCost = totalCost + ' INR'
        multiDetails[0].totalDuration = totalDuration + ' mins'
        multiDetails[0].totalDistance = totalDistance + ' Kms'
        multiDetails[0].endLocation = endLocation
        multiDetails[0].userGPS = userGps
        det.sort((a, b) => (a.step < b.step) ? -1 : 1)
        multiDetails[0].details = det
        historyData.push(multiDetails[0])
      }
    } else {
      let endLocation

      details[i].details.status = details[i].status
      if (details[i].details.type == 'AUTO') { endLocation = details[i].details.end.address.ward } else if (details[i].type == 'BUS') {
        endLocation = details[i].details.end.descriptor.name
      }
      details[i].totalCost = details[i].details.price
      details[i].totalDuration = details[i].duration
      details[i].endLocation = endLocation
      details[i].rideTo = details[i].end
      details[i].userGPS = details[i].details.gps

      historyData.push(details[i])
    }
  }
  return historyData
}

/**
 * Update history status by id
 */

const updateHistoryStatus = async (userId, id, orderId, payload) => {
  try {
    const history = await Journey_history.findAll({ where: { routeId: id } })
    if (!history) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Route not found')
    }
    let historyData
    for (let i = 0; i < history.length; i++) {
      let details = {}
      details = Object.assign(details, history[i].dataValues.details)

      if (details.orderId == orderId) {
        historyData = history[i]

        if (payload.startTime) {
          details.startTime = payload.startTime
        }
        if (payload.endTime) {
          details.endTime = payload.endTime
        }

        Object.assign(history[i], { details, status: payload.status })

        await history[i].save()
        break
      }
    }

    return historyData
  } catch (err) {
    logger.error('error is ' + err)
  }
}

const addRide = async (user, payload, routeId, routeType, status) => {
  // Delete all previous searches
  if (status == 'CONFIRMED' || status == 'COMPLETED') {
    await Rides.destroy({ where: { status: 'SEARCH', userId: user.id } })
  }

  const ridePayload = {
    userId: user.id,
    details: payload,
    type: routeType,
    routeId,
    status

  }
  let ridedetails = null
  try {
    ridedetails = await Rides.create(ridePayload)
  } catch (err) {
    logger.error('error in sequelize in creating ride ' + err)
  }
  return ridedetails
}

const updateRideById = async (id, payload) => {
  const rides = await Rides.findOne({ where: { id } })
  if (!rides) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Ride not found')
  }
  try {
    Object.assign(rides, payload)

    rides.save()
  } catch (err) {
    logger.error('error in updating ride' + err)
  }
  return rides
}

const updateRideStatus = async () => {
  const rides = await Rides.findAll({ raw: true })
  if (rides && rides.length > 0) {
    for (const ride of rides) {
      if (ride.type == 'MULTI') {
        const routeDetails = ride.details
        if (routeDetails.type == 'AUTO') {
          updateAutoRideStatus(ride)
        }
      } else if (ride.type == 'AUTO') {
        updateAutoRideStatus(ride)
      }
    }
  }
}

/* Updating auto ride status for testing purpose  after certain time interval */
const updateAutoRideStatus = async (ride) => {
  const date1 = dayjs(ride.updatedAt)
  const date2 = dayjs()
  const diff = date2.diff(date1, 's')
  const details = ride.details

  if (ride.status == 'CONFIRMED') {
    if (diff >= 40) {
      details.startTime = dayjs(new Date()).utc().local().tz().format('YYYY-MM-DD HH:mm')

      updateRideById(ride.id, { status: 'IN_PROGRESS', details })
      updateHistoryStatus(null, ride.routeId, ride.details.order_id, { startTime: details.startTime, status: 'IN_PROGRESS' })
    }
  } else if (ride.status == 'IN_PROGRESS') {
    if (diff >= 40) {
      details.endTime = dayjs(new Date()).utc().local().tz().format('YYYY-MM-DD HH:mm')
      updateRideById(ride.id, { status: 'COMPLETED', details })
      updateHistoryStatus(null, ride.routeId, ride.details.order_id, { endTime: details.endTime, status: 'COMPLETED' })
    }
  }
}

const getRideById = async (id, status = null) => {
  let details
  if (status) { details = await Rides.findAll({ where: { routeId: id, status }, raw: true }) } else { details = await Rides.findAll({ where: { routeId: id }, raw: true }) }

  return details
}

const getRidesList = async (user) => {
  let details = await Rides.findAll({
    where: {
      userId: user.id,
      status: { [Op.ne]: 'SEARCH' }
    },
    order: [['updatedAt', 'DESC']],
    raw: true
  })
  const ridesData = []
  if (details && details.length > 0) {
    details = details[0]
    let status = details.status

    if (details.type == 'MULTI') {
      const multiDetails = await Rides.findAll({ where: { routeId: details.routeId }, order: [['updatedAt', 'DESC']], raw: true })
      const det = []

      const multiModeIds = []
      status = 'IN_PROGRESS'
      let completedCount = 0

      for (let j = 0; j < multiDetails.length; j++) {
        const date1 = dayjs(multiDetails[j].updatedAt)
        const date2 = dayjs()
        const diff = date2.diff(date1, 'm')
        if (multiDetails[j].status == 'SELECTED') {
          for (let k = 0; k < multiDetails[j].details.length; k++) {
            if (!multiModeIds.includes(multiDetails[j].details[k].id)) {
              if (diff >= USER_IDLE_TIME) {
                let historyData

                if (multiDetails[j].details[k].type == 'AUTO') {
                  historyData = {
                    id: multiDetails[j].details[k].id,
                    type: multiDetails[j].details[k].type,
                    orderId: '',
                    price: multiDetails[j].details[k].price.value + ' ' + multiDetails[j].details[k].price.currency,
                    start: multiDetails[j].details[k].fulfillment.start.location,
                    end: multiDetails[j].details[k].fulfillment.end.location,
                    vehicleDetails: multiDetails[j].details[k].fulfillment.vehicle,
                    distance: multiDetails[j].details[k].distance,
                    duration: multiDetails[j].details[k].duration,
                    gps: multiDetails[j].details[k].gps,
                    step: multiDetails[j].details[k].step
                  }
                } else {
                  historyData = {
                    id: multiDetails[j].details[k].id,
                    type: multiDetails[j].details[k].type,
                    orderId: multiDetails[j].details[k].order_id,
                    price: parseFloat(multiDetails[j].details[k].price.price.value).toFixed(2) + ' ' + multiDetails[j].details[k].price.price.currency,

                    start: multiDetails[j].details[k].fulfillment.start.location,
                    end: multiDetails[j].details[k].fulfillment.end.location,
                    vehicleDetails: multiDetails[j].details[k].fulfillment.vehicle,
                    qrImage: '',
                    distance: multiDetails[j].details[k].distance,
                    duration: multiDetails[j].details[k].duration,
                    gps: multiDetails[j].details[k].gps,
                    startTime: multiDetails[j].details[k].startTime,
                    endTime: multiDetails[j].details[k].endTime,
                    distanceFromStartPoint: multiDetails[j].details[k].distanceFromStartPoint,
                    durationFromStartPoint: multiDetails[j].details[k].durationFromStartPoint,
                    endPointAddress: multiDetails[j].details[k].endPointAddress,
                    startPointAddress: multiDetails[j].details[k].startPointAddress,
                    distanceToEndPoint: multiDetails[j].details[k].distanceToEndPoint,
                    durationToEndPoint: multiDetails[j].details[k].durationToEndPoint,
                    step: multiDetails[j].details[k].step
                  }
                }

                addHistory(user, historyData, details.routeId, details.type, 'CANCELLED')

                addRide(user, multiDetails[j].details[k], details.routeId, details.type, 'CANCELLED')
                status = 'CANCELLED'
                multiDetails[j].details[k].status = 'CANCELLED'

                det.push(multiDetails[j].details[k])

                multiModeIds.push(multiDetails[j].details[k].id)
              } else {
                det.push(multiDetails[j].details[k])
                multiDetails[j].details[k].status = 'SELECTED'
                multiModeIds.push(multiDetails[j].details[k].id)
              }
            }
          }
        } else {
          if (multiDetails[j].status == 'COMPLETED') { completedCount += 1 }
          if (multiDetails[j].details.id) {
            if (!(multiModeIds.includes(multiDetails[j].details.id))) {
              if ((multiDetails[j].status == 'CONFIRMED' || multiDetails[j].status == 'IN_PROGRESS') && diff >= USER_IDLE_TIME) {
                multiDetails[j].details.status = 'COMPLETED'
                multiDetails[j].status = 'COMPLETED'

                const oldRide = await Rides.findOne({ where: { id: multiDetails[j].id } })
                Object.assign(oldRide, multiDetails[j])
                oldRide.save()
                updateHistoryStatus(user.id, multiDetails[j].routeId, multiDetails[j].details.order_id, { status: 'COMPLETED' })
              }
              if (multiDetails[j].status == 'FAILED' || multiDetails[j].status == 'CANCELLED') { status = multiDetails[j].status }
              multiDetails[j].details.status = multiDetails[j].status
              det.push(multiDetails[j].details)
              multiModeIds.push(multiDetails[j].details.id)
            }
          }
        }
      }
      det.sort((a, b) => (a.step < b.step) ? -1 : 1)
      multiDetails[0].details = det
      if (det.length == completedCount) { multiDetails[0].status = 'COMPLETED' } else { multiDetails[0].status = status }

      ridesData.push(multiDetails[0])
    } else {
      if (details.status != 'SELECTED') {
        details.details.status = details.status
        const singleJourneyDetails = details.details
        details.details = []

        details.details.push(singleJourneyDetails)
        ridesData.push(details)
      }
    }

    if (ridesData.length > 0) {
      const feedbackData = await Feedback.findOne({ where: { routeId: ridesData[0].routeId, userId: user.id }, raw: true })
      if (feedbackData) {
        ridesData[0].feedBackScreenDisplayed = feedbackData.feedBackScreenDisplayed
      } else { ridesData[0].feedBackScreenDisplayed = false }
      return [ridesData[0]]
    } else { return [] }
  }
  return []
}

const updateBusRideStatus = async (user, payload) => {
  const rides = await Rides.findAll({ where: { routeId: payload.routeId }, raw: true })
  if (rides && rides.length > 0) {
    for (const ride of rides) {
      let status
      if (ride.details.order_id == payload.order_id) {
        if (payload.status == 'RIDE_IN_PROGRESS') { status = 'IN_PROGRESS' } else { status = 'COMPLETED' }
        updateRideById(ride.id, { status })
        updateHistoryStatus(user.id, ride.routeId, ride.details.order_id, { status })
      }
    }
  }
}

const updateFeedback = async (user, payload) => {
  const data = await Feedback.findOne({ where: { routeId: payload.routeId, userId: user.id } })
  if (!data) {
    const feedbackData = {
      userId: user.id,
      routeId: payload.routeId,
      feedback: payload.feedback,
      rating: payload.rating,
      comments: payload.comments || '',
      skip: payload.skip || 0,
      feedBackScreenDisplayed: payload.feedBackScreenDisplayed || 0
    }
    await Feedback.create(feedbackData)
  } else {
    const feedbackData = {
      userId: user.id,
      routeId: payload.routeId,
      feedback: payload.feedback,
      rating: payload.rating,
      comments: payload.comments || '',
      skip: payload.skip || 'false',
      feedBackScreenDisplayed: payload.feedBackScreenDisplayed || 0
    }
    Object.assign(data, feedbackData)
    await data.save()
  }
  return { message: 'Updated rating' }
}

const deleteOldTransaction = async (user) => {
  Rides.destroy({
    where: {
      userId: user.id,
      [Op.or]: [
        { status: 'SEARCH' },
        { status: 'SELECTED' }
      ]
    }
  })
}

module.exports = {
  addHistory,
  getHistoryByUser,
  updateHistoryStatus,
  addRide,
  getRideById,
  getRidesList,
  updateRideStatus,
  updateBusRideStatus,
  updateFeedback,
  deleteOldTransaction,
  updateRideById
}
