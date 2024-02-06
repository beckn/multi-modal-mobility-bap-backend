const httpStatus = require('http-status')
const { amnex_mobilityConfig, bapClientUrl, server_url, AUTO_BOOKING_MIN_DISTANCE } = require('../config/config')
const ApiError = require('../utils/ApiError')
const axios = require('axios')
const { v4: uuidv4 } = require('uuid')
const nammaYatriService = require('./nammayatri_bpp.service')
const historyService = require('./history.service')
const { edrLogger, logger } = require('../config/logger')

const miscUtils = require('../utils/misc')

const dayjs = require('dayjs')
const customParseFormat = require('dayjs/plugin/customParseFormat')
dayjs.extend(customParseFormat)

const NodeCache = require('node-cache')
const modeCache = new NodeCache()


// Get available list of buses
const getListOfBusesAvailable = async (payload, user) => {
  let busDetails = null
  let error = false
  let errorDetails = null
  let status = 200
  let journey = []
  const responseToBeSent = []
  const data = {
    context: {
    },
    message: {
      intent: {
        fulfillment: {
          start: {
            location: { gps: payload.start }
          },
          end: {
            location: { gps: payload.end }
          }
        }
      }
    }
  }
  data.context = amnex_mobilityConfig
  data.context.timestamp = new Date().toISOString()
  data.context.transaction_id = uuidv4()

  const config = {
    method: 'post',
    url: bapClientUrl + '/search',
    headers: {
      'Content-Type': 'application/json'
    },
    data
  }

  await axios(config)
    .then(function (response) {
      logger.info('response from amnex :' + JSON.stringify(response.data))
      if (response.data.responses && response.data.responses.length > 0 && response.data.responses[0].message) {
        busDetails = response.data.responses[0].message
        const routes = []

        if (busDetails) {
          const items = busDetails.catalog['bpp/providers'][0].items
          const fulfillment = busDetails.catalog['bpp/providers'][0].fulfillments

          for (const item of items) {
            for (const data of fulfillment) {
              if (item.fulfillment_id == data.id) {
                item.fulfillment = data
                break
              }
            }

            const itemData = {
              id: item.id,
              context: response.data.responses[0].context,
              provider: {
                id: busDetails.catalog['bpp/providers'][0].id,
                name: busDetails.catalog['bpp/providers'][0].descriptor.name
              },
              routeName: item.fulfillment.tags['groups/0/list/0/value'],
              routeNo: item.fulfillment.tags['groups/0/list/1/value'],
              routeId: item.fulfillment.tags['groups/0/list/2/value'],
              tripId: item.fulfillment.tags['groups/0/list/3/value'],
              distance: item.fulfillment.tags['groups/0/list/4/value'],
              duration: item.fulfillment.tags['groups/0/list/5/value'],
              busTravelTime: item.fulfillment.tags['groups/0/list/5/value'] + ' mins',
              startTime: item.fulfillment.tags['groups/0/list/6/value'],
              endTime: item.fulfillment.tags['groups/0/list/7/value'],
              vehicleName: item.fulfillment.tags['groups/1/list/0/value'],
              vehicleNo: item.fulfillment.tags['groups/1/list/1/value'],
              price: item.price,
              start: {
                name: item.fulfillment.start.location.descriptor.name,
                gps: item.fulfillment.start.location.gps
              },
              end: {
                name: item.fulfillment.end.location.descriptor.name,
                gps: item.fulfillment.end.location.gps
              },
              distanceFromStartPoint: item.fulfillment.tags['groups/3/list/0/value'],
              distanceFromEndPoint: item.fulfillment.tags['groups/3/list/1/value'],
              type: 'BUS',
              gps: payload

            }
            routes.push(itemData)
          }
          busDetails = routes
        }
      }
    })
    .catch(function (err) {
      logger.error('Error is '+ err)
      busDetails = null
      error = true
      if (err.response) {
        errorDetails = err.response.data
        status = err.response.status
      }
      return { details: busDetails, error, errorDetails, status }
    })

    //Sort bus list based on distance from startpoint
  if (busDetails && busDetails.length > 1) { busDetails.sort((a, b) => (a.distanceFromStartPoint < b.distanceFromStartPoint) ? -1 : 1) }

  //Remove buses with same route no
  if (busDetails && busDetails.length > 0) {
    busDetails = busDetails.reduce((arr, item) => {
      const removed = arr.filter(i => i.routeNo !== item.routeNo)
      return [...removed, item]
    }, [])
    const details = busDetails

    for (let k = 0; k < details.length; k++) {
      journey = []
      let multi = 0
      const busfare = parseFloat(details[k].price.value).toFixed(2)
      let totalCost = Number(busfare)
      let totalCostMin = totalCost
      let totalCostMax = totalCost
      let totalDistance = Number(details[k].distance) + Number(details[k].distanceFromStartPoint) + Number(details[k].distanceFromEndPoint)
      totalDistance = parseFloat(totalDistance).toFixed(2) + ' Km'
      let totalDuration = parseFloat(details[k].duration)

      let min_auto_start_distance = AUTO_BOOKING_MIN_DISTANCE
      let min_auto_end_distance = AUTO_BOOKING_MIN_DISTANCE
      journey.push(details[k])
      const cache_start_distance = modeCache.get('AUTO_BOOKING_START_DISTANCE')
      const cache_end_distance = modeCache.get('AUTO_BOOKING_END_DISTANCE')
      if (cache_start_distance) {
        min_auto_start_distance = cache_start_distance
      }
      if (cache_end_distance) {
        min_auto_end_distance = cache_end_distance
      }

      if (payload.type != 'BUS' && !Number(details[k].distanceFromStartPoint) > min_auto_start_distance) {
        const autoPayload = {
          start: payload.start,
          end: busDetails[k].start.gps
        }

        const autoDetails = await nammaYatriService.getListOfAutosAvailable(autoPayload)
        if (autoDetails && !autoDetails.error && autoDetails.details.length > 0) {
          multi = 1
          totalCostMin = Number(busfare) + Number(autoDetails.details[0].price.maximum_value)
          totalCostMax = (Number(busfare) + Number(autoDetails.details[0].price.minimum_value))
          totalDuration += Number(autoDetails.details[0].duration.split(' ')[0])
          journey.unshift(autoDetails.details[0])

          details[k].distanceFromStartPoint = 0
          details[k].durationFromStartPoint = 0
        }
      }
      if (multi == 0) {
        const distanceResult = await miscUtils.getDistanceMatrix([payload.start], [details[k].start.gps], 'walking')
        let duration = 0
        let distance
        let destination, origin
        if (distanceResult) {
          distance = distanceResult.distance
          duration = distanceResult.duration

          destination = distanceResult.destination
          origin = distanceResult.origin
        }
        details[k].distanceFromStartPoint = distance
        details[k].durationFromStartPoint = duration
        // details[k].endPointAddress = destination
        details[k].startPointAddress = origin

        details[k].routeId = uuidv4()
      }

      if (payload.type != 'BUS' && Number(details[k].distanceFromEndPoint) > min_auto_end_distance) {
        const autoPayloadend = {
          start: busDetails[k].end.gps,
          end: payload.end
        }

        const autoDetailsend = await nammaYatriService.getListOfAutosAvailable(autoPayloadend)
        if (autoDetailsend && !autoDetailsend.error && autoDetailsend.details.length > 0) {
          multi = 1
          totalCostMin = Number(totalCostMin) + Number(autoDetailsend.details[0].price.maximum_value)
          totalCostMax = (Number(totalCostMax) + Number(autoDetailsend.details[0].price.minimum_value))

          journey.push(autoDetailsend.details[0])
          // s totalDuration += Number(autoDetailsend.details[0].duration.split(' ')[0]);
          totalDuration = Number(dayjs(details[k].endTime, 'hh:mm:ss').diff(dayjs.tz(dayjs()), 'm')) + Number(autoDetailsend.details[0].duration.split(' ')[0]) - 330
          details[k].distanceToEndPoint = 0
          delete details[k].distanceFromEndPoint
          details[k].durationToEndPoint = 0
        } else {
          const distanceResult = await miscUtils.getDistanceMatrix([details[k].end.gps], [payload.end], 'walking')

          let duration = 0
          let destination, origin, distance
          if (distanceResult) {
            distance = distanceResult.distance
            duration = distanceResult.duration

            destination = distanceResult.destination
            origin = distanceResult.origin
          }
          details[k].distanceToEndPoint = distance
          delete details[k].distanceFromEndPoint
          details[k].durationToEndPoint = duration
          details[k].endPointAddress = destination
          details[k].startPointAddress = origin

          totalDuration = Number(dayjs(details[k].endTime, 'hh:mm:ss').diff(dayjs.tz(dayjs()), 'm')) + Number(duration.split(' ')[0]) - 330
        }
      } else {
        const distanceResult = await miscUtils.getDistanceMatrix([details[k].end.gps], [payload.end], 'walking')

        let duration = 0
        let destination, origin, distance
        if (distanceResult) {
          distance = distanceResult.distance
          duration = distanceResult.duration
          destination = distanceResult.destination
          origin = distanceResult.origin
        }
        details[k].distanceToEndPoint = distance
        delete details[k].distanceFromEndPoint
        details[k].durationToEndPoint = duration
        details[k].endPointAddress = destination

        totalDuration = Number(dayjs(details[k].endTime, 'hh:mm:ss').diff(dayjs.tz(dayjs()), 'm')) + Number(duration.split(' ')[0]) - 330
      }
      details[k].startTime = dayjs('1/1/1 ' + details[k].startTime).format('hh:mm a')
      details[k].endTime = dayjs('1/1/1 ' + details[k].endTime).format('hh:mm a')
      if (multi) {
        totalCost = totalCostMin + ' - ' + totalCostMax + ' INR'
        details[k].distance = parseFloat(details[k].distance).toFixed(2) + ' Km'
        details[k].duration = parseFloat(details[k].duration).toFixed(2) + ' mins'
        details[k].price.value = parseFloat(details[k].price.value).toFixed(2) + ' INR'
        responseToBeSent.push({ routeId: uuidv4(), type: 'MULTI', totalCost, totalDistance, totalDuration: totalDuration + ' min', routes: journey })
      } else {
        details[k].distance = totalDistance
        details[k].duration = totalDuration + ' mins'
        details[k].price.value = parseFloat(totalCost).toFixed(2) + ' INR'

        responseToBeSent.push({ type: 'BUS', ...details[k] })
      }
    }
  }
  for (const response of responseToBeSent) {
    if (response.type == 'MULTI') { historyService.addRide(user, response.routes, response.routeId, response.type, 'SEARCH') } else { historyService.addRide(user, response, response.routeId, response.type, 'SEARCH') }
  }

  return responseToBeSent
}

const selectBusRide = async (payload, routeId, routeType) => {
  const data = {
    context: {
    },
    message: {
      order: {
        items: [
          {
            id: payload.id
          }
        ],
        provider: {
          id: payload.provider.id
        }
      }
    }
  }
  data.context = payload.context
  data.context.action = 'select'
  data.context.timestamp = new Date().toISOString()
  data.context.message_id = uuidv4()

  const config = {
    method: 'post',
    url: bapClientUrl + '/select',
    headers: {
      'Content-Type': 'application/json'
    },
    data
  }
  let selectedAutoDetails = null
  await axios(config)
    .then(function (response) {
      if (response.data.responses && response.data.responses.length > 0) {
        const selectRide = response.data.responses[0].message
        selectedAutoDetails = {
          routeId,
          routeType,
          distance: payload.distance,
          duration: payload.duration,
          context: response.data.responses[0].context,
          provider: selectRide.order.provider,
          id: selectRide.order.items[0].id,
          fulfillment_id: selectRide.order.items[0].fulfillment_id,
          payment_id: selectRide.order.items[0].payment_id,
          price: selectRide.order.quote,
          fulfillment: selectRide.order.fulfillment,
          type: 'BUS',
          gps: payload.gps,
          step: payload.step,
          distanceFromStartPoint: payload.distanceFromStartPoint,
          durationFromStartPoint: payload.durationFromStartPoint,
          endPointAddress: payload.endPointAddress,
          startPointAddress: payload.startPointAddress,
          distanceToEndPoint: payload.distanceToEndPoint,
          durationToEndPoint: payload.durationToEndPoint,
          startTime: payload.startTime,
          endTime: payload.endTime
        }
      } else {
        throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed selecting bus')
      }
    })
    .catch(function (error) {
      logger.error('Error is ' + error)
    })
  return selectedAutoDetails
}

const confirmBusRide = async (user, payload) => {
  // init ride
  const data = {
    context: {
    },

    message: {
      order: {
        items: [
          {
            id: payload.id,
            quantity: {
              count: payload.quantity || 1
            }
          }
        ],
        provider: {
          id: payload.provider.id
        },
        billing: {
          name: user.name || 'demo',
          email: user.email || 'demo@gmail.com',
          phone: user.mobileNo
        }
      }
    }

  }
  data.context = payload.context
  data.context.action = 'init'
  data.context.timestamp = new Date().toISOString()
  data.context.message_id = uuidv4()

  const config = {
    method: 'post',
    url: bapClientUrl + '/init',
    headers: {
      'Content-Type': 'application/json'
    },
    data
  }
  logger.info('request to bus confirm ' + JSON.stringify(data))
  let initedRide = null
  await axios(config)
    .then(async function (response) {
      logger.info('response from bus ' + JSON.stringify(response.data))
      if (response.data.responses && response.data.responses.length > 0) {
        const initedRideDetails = response.data.responses[0].message
        initedRide = {
          type: 'BUS',
          context: response.data.context,
          id: initedRideDetails.order.items[0].id,
          routeId: payload.routeId,
          routeType: payload.routeType,
          provider: initedRideDetails.order.provider,
          fulfillment: initedRideDetails.order.fulfillment,
          price: initedRideDetails.order.quote.price,
          distance: payload.distance,
          duration: payload.duration,
          payment: initedRideDetails.order.payment,
          vehicleNo: initedRideDetails.order.fulfillment.tags['groups/1/list/1/value'],
          vehicleType: initedRideDetails.order.fulfillment.tags['groups/1/list/0/value'],
          routeNo: initedRideDetails.order.fulfillment.tags['groups/0/list/1/value'],
          step: payload.step,
          gps: payload.gps,
          distanceFromStartPoint: payload.distanceFromStartPoint,
          durationFromStartPoint: payload.durationFromStartPoint,
          endPointAddress: payload.endPointAddress,
          startPointAddress: payload.startPointAddress,
          distanceToEndPoint: payload.distanceToEndPoint,
          durationToEndPoint: payload.durationToEndPoint,
          startTime: payload.startTime,
          endTime: payload.endTime

        }
      }
    })
    .catch(function (error) {
      logger.error('Error is ' + error)
    })
  if (!initedRide || initedRide.payment.status == 'FAILED') {
    const historyData = {
      id: payload.id,
      orderId: '',
      price: parseFloat(payload.price.price.value).toFixed(2) + ' ' + payload.price.price.currency,
      type: 'BUS',
      start: payload.fulfillment.start.location,
      end: payload.fulfillment.end.location,
      vehicleDetails: payload.fulfillment.vehicle,
      qrImage: '',
      distance: payload.distance,
      duration: payload.duration,
      gps: payload.gps,
      distanceFromStartPoint: payload.distanceFromStartPoint,
      durationFromStartPoint: payload.durationFromStartPoint,
      endPointAddress: payload.endPointAddress,
      startPointAddress: payload.startPointAddress,
      distanceToEndPoint: payload.distanceToEndPoint,
      durationToEndPoint: payload.durationToEndPoint,
      step: payload.step
    }
    historyService.addHistory(user, historyData, payload.routeId, payload.routeType, 'FAILED')
    historyService.addRide(user, payload, payload.routeId, payload.routeType, 'FAILED')
    edrLogger.info(JSON.stringify({ message: 'Confirming ride', state: 'FAILED', type: payload.routeTypetype, user: user.id, routeId: payload.routeId }))
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed transaction')
  }

  const confirmedDetails = await bookBusTicket(user, initedRide)
  confirmedDetails.fulfillment = initedRide.fulfillment
  return confirmedDetails
}

const bookBusTicket = async (user, payload) => {
  // init ride

  const data = {
    context: {
    },

    message: {
      order: {
        items: [
          {
            id: payload.id
          }
        ],
        provider: {
          id: payload.provider.id
        },
        billing: {
          name: user.name || 'demo',
          email: user.email || 'demo@gmail.com',
          phone: user.mobileNo
        },
        payment: {
          params: {
            amount: payload.price.value,
            currency: payload.price.currency,
            transaction_id: payload.payment.params.transaction_id
          }
        }
      }
    }
  }
  data.context = payload.context
  data.context.action = 'confirm'
  data.context.timestamp = new Date().toISOString()
  data.context.message_id = uuidv4()

  logger.info('booking ticket req ' + data)

  const config = {
    method: 'post',
    url: bapClientUrl + '/confirm',
    headers: {
      'Content-Type': 'application/json'
    },
    data
  }
  let confirmedDetails = null
  let paymentStatus = true
  await axios(config)
    .then(async function (response) {
      if (response.data.responses && response.data.responses.length > 0) {
        const confirmRide = response.data.responses[0].message
        if (confirmRide.order.payment.status == 'PAID') {
          const qrImage = await miscUtils.generateQR(confirmRide.order.fulfillment.start.authorization)
          confirmedDetails = {
            order_id: confirmRide.order.id,
            provider: confirmRide.order.provider,
            id: confirmRide.order.item[0].id,
            fulfillment_id: confirmRide.order.item[0].fulfillment_id,
            payment_id: confirmRide.order.item[0].payment_id,
            price: confirmRide.order.quote,
            fulfillment: confirmRide.order.fulfillment,
            payment: confirmRide.order.payment,
            qr: server_url + '/qrcodes/' + qrImage,
            validFrom: confirmRide.order.fulfillment.start.authorization.valid_from,
            validTo: confirmRide.order.fulfillment.start.authorization.valid_to,
            type: 'BUS',
            distance: payload.distance,
            duration: payload.duration,
            vehicleNo: payload.vehicleNo,
            vehicleType: payload.vehicleType,
            routeId: payload.routeId,
            routeType: payload.routeType,
            routeNo: payload.routeNo,
            step: payload.step,
            startTime: payload.startTime,
            endTime: payload.endTime,
            gps: payload.gps,
            distanceFromStartPoint: payload.distanceFromStartPoint,
            durationFromStartPoint: payload.durationFromStartPoint,
            endPointAddress: payload.endPointAddress,
            startPointAddress: payload.startPointAddress,
            distanceToEndPoint: payload.distanceToEndPoint,
            durationToEndPoint: payload.durationToEndPoint

          }
        } else {
          paymentStatus = false
        }
      }
    })
    .catch(function (error) {
      logger.error('Error is ' + error)
    })
  if (!paymentStatus) {
    logger.info('payload is ' + payload)
    const historyData = {
      type: payload.routeType,
      id: payload.id,
      orderId: '',
      price: parseFloat(payload.price.value).toFixed(2) + ' ' + payload.price.currency,

      start: payload.fulfillment.start.location,
      end: payload.fulfillment.end.location,
      vehicleDetails: payload.fulfillment.vehicle,
      qrImage: '',
      distance: payload.distance,
      duration: payload.duration,
      gps: payload.gps,
      distanceFromStartPoint: payload.distanceFromStartPoint,
      durationFromStartPoint: payload.durationFromStartPoint,
      endPointAddress: payload.endPointAddress,
      startPointAddress: payload.startPointAddress,
      distanceToEndPoint: payload.distanceToEndPoint,
      durationToEndPoint: payload.durationToEndPoint,
      startTime: payload.startTime,
      endTime: payload.endTime,
      step: payload.step
    }
    historyService.addHistory(user, historyData, payload.routeId, payload.routeType, 'FAILED')
    historyService.addRide(user, payload, payload.routeId, payload.routeType, 'FAILED')
    edrLogger.info(JSON.stringify({ message: 'Confirming ride', state: 'FAILED', type: payload.routeTypetype, user: user.id, routeId: payload.routeId }))
    throw new ApiError(httpStatus.BAD_REQUEST, 'Failed booking ticket - Payment not done')
  }
  if (!confirmedDetails) {
    const historyData = {
      type: payload.routeTypeype,
      id: payload.id,
      orderId: '',
      price: parseFloat(payload.price.value).toFixed(2) + ' ' + payload.price.currency,

      start: payload.fulfillment.start.location,
      end: payload.fulfillment.end.location,
      vehicleDetails: payload.fulfillment.vehicle,
      qrImage: '',
      distance: payload.distance,
      duration: payload.duration,
      gps: payload.gps,
      distanceFromStartPoint: payload.distanceFromStartPoint,
      durationFromStartPoint: payload.durationFromStartPoint,
      endPointAddress: payload.endPointAddress,
      startPointAddress: payload.startPointAddress,
      distanceToEndPoint: payload.distanceToEndPoint,
      durationToEndPoint: payload.durationToEndPoint,
      startTime: payload.startTime,
      endTime: payload.endTime,
      step: payload.step
    }
    historyService.addHistory(user, historyData, payload.routeId, payload.routeType, 'FAILED')
    historyService.addRide(user, payload, payload.routeId, payload.routeType, 'FAILED')
    edrLogger.info(JSON.stringify({ message: 'Confirming ride', state: 'FAILED', type: payload.routeTypetype, user: user.id, routeId: payload.routeId }))
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed booking ticket')
  }
  return confirmedDetails
}

/* For testing  different modes
1 -> Auto + bus
2 -> Bus + Auto
3 -> Auto + Bus +Auto
4 -> Only Bus
*/
const updateModeType = async (query) => {
  if (query.type == 1) {
    modeCache.set('AUTO_BOOKING_START_DISTANCE', 0.75)
    modeCache.set('AUTO_BOOKING_END_DISTANCE', 0.75)
  }
  if (query.type == 2) {
    modeCache.set('AUTO_BOOKING_START_DISTANCE', 1.75)
    modeCache.set('AUTO_BOOKING_END_DISTANCE', 0.1)
  }
  if (query.type == 3) {
    modeCache.set('AUTO_BOOKING_START_DISTANCE', 0.75)
    modeCache.set('AUTO_BOOKING_END_DISTANCE', 0.1)
  }

  if (query.type == 4) {
    modeCache.set('AUTO_BOOKING_START_DISTANCE', 5.75)
    modeCache.set('AUTO_BOOKING_END_DISTANCE', 5)
  }
  return 1
}

module.exports = {
  selectBusRide,
  confirmBusRide,
  bookBusTicket,
  getListOfBusesAvailable,
  updateModeType
}
