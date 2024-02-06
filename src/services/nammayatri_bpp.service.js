const httpStatus = require('http-status')
const { nammaYatri_mobilityConfig, bapClientUrl } = require('../config/config')
const ApiError = require('../utils/ApiError')
const axios = require('axios')
const { v4: uuidv4 } = require('uuid')
const historyService = require('./history.service')
const miscUtils = require('../utils/misc')
const { edrLogger, logger } = require('../config/logger')
const dayjs = require('dayjs')

// const {genQR} = require('./qrgen.service')

const getListOfAutosAvailable = async (payload) => {
  // Get list of autos
  let autoDetails = []
  let error = false
  let errorDetails = null
  let status = 200
  const data = {
    context: {
    },
    message: {
      intent: {
        fulfillment: {
          start: {
            location: { gps: payload.start.toString() }
          },
          end: {
            location: { gps: payload.end }
          }
        }
      }
    }
  }
  data.context = nammaYatri_mobilityConfig
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
  let originalReq = {}
  originalReq = Object.assign(originalReq, payload)
  await axios(config)
    .then(async function (response) {
      if (response.data.responses && response.data.responses.length > 0) {
        autoDetails = response.data.responses[0].message
        const routes = []
        if (autoDetails) {
          const distanceResult = await miscUtils.getDistanceMatrix([payload.start], [payload.end])
          let distance = null
          let duration = null
          if (distanceResult) {
            distance = distanceResult.distance
            duration = distanceResult.duration
          }
          const items = autoDetails.catalog['bpp/providers'][0].items
          const fulfillment = autoDetails.catalog['bpp/providers'][0].fulfillments

          for (let i = 0; i < items.length; i++) {
            for (let j = 0; j < fulfillment.length; j++) {
              if (items[i].fulfillment_id == fulfillment[j].id) {
                items[i].fulfillment = fulfillment[j]
                break
              }
            }
            logger.info('in auto payload is ' + payload)
            const itemData = {
            // id: items[i].id, //TO-DO - use this id once integrated with NY
              id: uuidv4(), // Added for testing purpose since id returned is same everytime
              routeId: uuidv4(),
              context: response.data.responses[0].context,
              price: items[i].price,
              start: {
                address: items[i].fulfillment.start.location.address,
                gps: items[i].fulfillment.start.location.gps
              },
              end: {
                address: items[i].fulfillment.end.location.address,
                gps: items[i].fulfillment.end.location.gps
              },
              distance,
              duration,
              distanceFromStartPoint: items[i].tags['groups/3/list/1/value'],
              waitTimeUpto: items[i].tags['groups/3/list/2/value'],
              type: 'AUTO',
              gps: originalReq
            }
            routes.push(itemData)
          }
          autoDetails = routes

          if (autoDetails.length > 1) {
            autoDetails.sort((a, b) => {
              return b.price.maximum_value - a.price.maximum_value
            })
          }
        }
      }
    })
    .catch(function (err) {
      logger.error('Error in getting auto details ' + err)
      autoDetails = null
      error = true
      if (err.response) {
        errorDetails = err.response.data
        status = err.response.status
      }
    })

  return { details: autoDetails, error, errorDetails, status }
}

const selectAutoRide = async (user, payload, routeId, routeType) => {
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
        fulfillment: {
          start: {
            location: {
              gps: payload.start.gps
            }
          },
          end: {
            location: {
              gps: payload.end.gps
            }
          }
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
        const selecdata = response.data.responses[0].message
        selectedAutoDetails = {
          routeId,
          routeType,
          distance: payload.distance,
          duration: payload.duration,
          context: response.data.responses[0].context,
          provider: selecdata.order.provider,
          id: payload.id,
          fulfillment_id: selecdata.order.items[0].fulfillment_id,
          payment_id: selecdata.order.items[0].payment_id,
          price: selecdata.order.quote,
          fulfillment: selecdata.order.fulfillment,
          type: 'AUTO',
          gps: payload.gps,
          step: payload.step
        }
      } else {
        const historyData = {
          id: payload.id,
          type: payload.routeType,
          orderId: '',
          price: payload.price,

          start: payload.fulfillment.start.location,
          end: payload.fulfillment.end.location,

          distance: payload.distance,
          duration: payload.duration,
          gps: payload.gps,
          step: payload.step

        }
        historyService.addHistory(user, historyData, payload.routeId, payload.routeType, 'FAILED')
        historyService.addRide(user, payload, payload.routeId, payload.routeType, 'FAILED')
        edrLogger.info(JSON.stringify({ message: 'Selecting ride', state: 'FAILED', type: payload.routeTypetype, user: user.id, routeId: payload.routeId }))
      }
    })
    .catch(function (error) {
      logger.error('Error in selecting auto ' + error)
    })
  return selectedAutoDetails
}

const confirmAutoRide = async (user, payload) => {
  // init ride
  const data = {
    context: {
    },
    message: {
      order: {
        provider: {
          id: payload.provider.id
        },
        items: [
          {
            id: payload.id,
            fulfillment_id: payload.fulfillment_id,
            payment_id: payload.payment_id
          }
        ],
        quote: payload.price,
        fulfillment: payload.fulfillment,
        payment: {
          id: payload.payment.id,
          type: 'ON-FULFILLMENT',
          collected_by: 'BPP'
        },
        customer: {
          person: {
            name: user.name,
            phone: user.mobileNo,
            tags: {
              'groups/1/descriptor/name': 'Localization',
              'groups/1/display': false,
              'groups/1/list/1/descriptor/name': 'Language',
              'groups/1/list/1/value': 'en'
            }
          }
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
  let confirmedAutoDetails = null
  await axios(config)
    .then(async function (response) {
      if (response.data.responses && response.data.responses.length > 0) {
        const initedRide = response.data.responses[0].message
        // confirm ride
        const confirmdata = {
          context: {
          },
          message: initedRide
        }
        confirmdata.context = response.data.responses[0].context
        confirmdata.context.action = 'confirm'
        confirmdata.context.timestamp = new Date().toISOString()
        confirmdata.context.message_id = uuidv4()

        const confirmconfig = {
          method: 'post',
          url: bapClientUrl + '/confirm',
          headers: {
            'Content-Type': 'application/json'
          },
          data: confirmdata
        }

        await axios(confirmconfig)
          .then(function (response) {
            const confirmdata = response.data.responses[0].message

            confirmedAutoDetails = {
              routeId: payload.routeId,
              context: response.data.responses[0].context,
              routeType: payload.routeType,
              order_id: uuidv4(), // confirmdata.order.id,
              provider: confirmdata.order.provider,
              id: payload.id,
              fulfillment_id: confirmdata.order.items[0].fulfillment_id,
              payment_id: confirmdata.order.items[0].payment_id,
              price: confirmdata.order.quote,
              fulfillment: confirmdata.order.fulfillment,
              payment: confirmdata.order.payment,
              type: 'AUTO',
              distance: payload.distance,
              duration: payload.duration,
              step: payload.step,
              gps: payload.gps
            }
          })
          .catch(function (error) {
            logger.error('Error is ' + error)
          })
      } else {
        const historyData = {
          id: payload.id,
          type: payload.routeType,
          orderId: '',
          price: payload.price,

          start: payload.fulfillment.start.location,
          end: payload.fulfillment.end.location,

          distance: payload.distance,
          duration: payload.duration,
          gps: payload.gps,
          step: payload.step

        }
        historyService.addHistory(user, historyData, payload.routeId, payload.routeType, 'FAILED')
        historyService.addRide(user, payload, payload.routeId, payload.routeType, 'FAILED')
        edrLogger.info(JSON.stringify({ message: 'Init ride', state: 'FAILED', type: payload.routeTypetype, user: user.id, routeId: payload.routeId }))
      }
    })
    .catch(function (error) {
      logger.error('Error is ' + error)
    })
  return confirmedAutoDetails
}

const cancelAutoBooking = async (user, payload) => {
  const routeDetails = await historyService.getRideById(payload.routeId, 'CONFIRMED')
  let rideDetails

  if (!routeDetails || routeDetails.length == 0) { throw new ApiError(httpStatus.NOT_FOUND, 'Route details not found') }
  for (let i = 0; i < routeDetails.length; i++) {
    if (routeDetails[i].type == 'MULTI') {
      if (routeDetails[i].details.type === 'AUTO' && routeDetails[i].details.order_id === payload.order_id) {
        payload = routeDetails[i].details
        rideDetails = routeDetails[i]
        break
      }
    } else if (routeDetails[i].type == 'AUTO' && routeDetails[i].details.order_id === payload.order_id) {
      rideDetails = routeDetails[i]
      payload = routeDetails[i].details
      break
    }
  }

  const createdDateTime = dayjs()
  const data = {
    context: {
    },
    message: {
      order_id: payload.order_id,
      cancellation_reason_id: '7'
    }
  }
  data.context = payload.context
  data.context.action = 'cancel'
  data.context.timestamp = new Date().toISOString()
  data.context.message_id = uuidv4()

  const config = {
    method: 'post',
    url: bapClientUrl + '/cancel',
    headers: {
      'Content-Type': 'application/json'
    },
    data
  }
  let cancelledAutoDetails = null
  await axios(config)
    .then(async function (response) {
      if (response.data.responses && response.data.responses.length > 0) {
        const selecdata = response.data.responses[0].message
        cancelledAutoDetails = {
          context: response.data.responses[0].context,
          status: selecdata.order.fulfillment.state.descriptor,
          type: 'AUTO'
        }

        historyService.updateRideById(rideDetails.id, { status: 'CANCELLED' })
        historyService.updateHistoryStatus(user.id, payload.routeId, payload.order_id, { status: 'CANCELLED' })
        const routes = await historyService.getRidesList(user)
        if (routes && routes.length > 0) {
          const lastRoute = routes[0]
          for (let j = 0; j < lastRoute.details.length; j++) {
            if (lastRoute.details[j].status == 'SELECTED') {
              let historyData
              if (lastRoute.details[j].type == 'AUTO') {
                historyData = {
                  id: lastRoute.details[j].id,
                  type: lastRoute.details[j].type,
                  orderId: '',
                  price: lastRoute.details[j].price.value + ' ' + lastRoute.details[j].price.currency,
                  start: lastRoute.details[j].fulfillment.start.location,
                  end: lastRoute.details[j].fulfillment.end.location,
                  vehicleDetails: lastRoute.details[j].fulfillment.vehicle,
                  distance: lastRoute.details[j].distance,
                  duration: lastRoute.details[j].duration,
                  gps: lastRoute.details[j].gps,
                  step: lastRoute.details[j].step
                }
              } else {
                historyData = {
                  id: lastRoute.details[j].id,
                  type: lastRoute.details[j].type,
                  orderId: '',
                  price: parseFloat(lastRoute.details[j].price.price.value).toFixed(2) + ' ' + lastRoute.details[j].price.price.currency,

                  start: lastRoute.details[j].fulfillment.start.location,
                  end: lastRoute.details[j].fulfillment.end.location,
                  vehicleDetails: lastRoute.details[j].fulfillment.vehicle,
                  qrImage: '',
                  distance: lastRoute.details[j].distance,
                  duration: lastRoute.details[j].duration,
                  gps: routeDetails.gps,
                  distanceFromStartPoint: lastRoute.details[j].distanceFromStartPoint,
                  durationFromStartPoint: lastRoute.details[j].durationFromStartPoint,
                  endPointAddress: lastRoute.details[j].endPointAddress,
                  startPointAddress: lastRoute.details[j].startPointAddress,
                  distanceToEndPoint: lastRoute.details[j].distanceToEndPoint,
                  durationToEndPoint: lastRoute.details[j].durationToEndPoint,
                  step: lastRoute.details[j].step
                }
              }
              historyService.addHistory(user, historyData, payload.routeId, payload.routeType, 'CANCELLED')
            }
          }
        }
      } else {
        logger.error('Failed cancelling ')
        throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Cancellation failed')
      }
    })
    .catch(function (error) {
      logger.error('Error is ' + error)
    })
  edrLogger.info(JSON.stringify({ message: 'Cancelling ride', user: user.id, state: 'CANCELLED', type: 'AUTO', routeId: payload.routeId, orderId: payload.order_id, responseTime: dayjs().diff(createdDateTime, 's') }))
  return cancelledAutoDetails
}

const trackAutoRide = async (user, payload) => {
  const data = {
    context: {
    },
    message: {
      order_id: payload.order_id
    }
  }
  data.context = payload.context
  data.context.action = 'track'
  data.context.timestamp = new Date().toISOString()
  data.context.message_id = uuidv4()

  const config = {
    method: 'post',
    url: bapClientUrl + '/track',
    headers: {
      'Content-Type': 'application/json'
    },
    data
  }
  let trackingDetails = null
  await axios(config)
    .then(function (response) {
      const selecdata = response.data.responses[0].message
      trackingDetails = {
        context: response.data.responses[0].context,
        status: selecdata.tracking.status,
        url: selecdata.tracking.url
      }
    })
    .catch(function (error) {
      logger.error('Error is ' + error)
    })
  return trackingDetails
}

const rateAutoRide = async (user, payload) => {
  // Integrate with rate api
  return {}
}

const getAutoRideStatus = async (user, payload) => {
  const data = {
    context: {
    },
    message: {
      order_id: payload.order_id
    }
  }
  data.context = payload.context
  data.context.action = 'status'
  data.context.timestamp = new Date().toISOString()
  data.context.message_id = uuidv4()

  const config = {
    method: 'post',
    url: bapClientUrl + '/status',
    headers: {
      'Content-Type': 'application/json'
    },
    data
  }
  let statusDetails = null
  await axios(config)
    .then(function (response) {
      const selecdata = response.data.responses[0].message
      statusDetails = {
        status: selecdata.order.fulfillment.state.descriptor
      }
    })
    .catch(function (error) {
      logger.error('Error in getting status ' + error)
    })
  return statusDetails
}

const getUpdates = async (user, payload) => {
  let routeDetails = await historyService.getRideById(payload.routeId)
  if (!routeDetails) { throw new ApiError(httpStatus.NOT_FOUND, 'Route details not found') }
  let ridedetails = null
  for (let i = 0; i < routeDetails.length; i++) {
    if (routeDetails[i].details.order_id && routeDetails[i].details.order_id == payload.order_id) {
      ridedetails = routeDetails[i]
      break
    }
  }
  if (!ridedetails) { throw new ApiError(httpStatus.NOT_FOUND, 'Route details not found') }
  routeDetails = ridedetails
  const details = {
    price: routeDetails.details.price,
    startTime: routeDetails.details.startTime,
    endTime: routeDetails.details.endTime,
    distance: routeDetails.details.distance,
    duration: routeDetails.details.duration,
    agent: routeDetails.details.fulfillment.agent,
    vehicle: routeDetails.details.fulfillment.vehicle
  }
  let statusDetails = {
    descriptor: {
      name: 'Ride Confirmed',
      code: 'RIDE_CONFIRMED'
    }

  }

  if (routeDetails.status == 'IN_PROGRESS') {
    statusDetails = {
      descriptor: {
        name: 'Ride In Progress',
        code: 'RIDE_IN_PROGRESS'
      }
    }
  } else if (routeDetails.status == 'COMPLETED') {
    statusDetails = {
      descriptor: {
        name: 'Ride Completed',
        code: 'RIDE_COMPLETED'
      }
    }
  }
  statusDetails.details = details

  // get update from bpp
  /*
    const data = {
      context: {
      },
      message: payload.message
    }
    data.message["update_target"] = "item,billing",
      data.context = payload.context
    data.context.action = 'update'
    data.context.timestamp = new Date().toISOString()
    data.context.message_id = uuidv4()

    const config = {
      method: 'post',
      url: bapClientUrl + '/update',
      headers: {
        'Content-Type': 'application/json'
      },
      data
    }
    let statusDetails = null
    await axios(config)
      .then(function (response) {
        const selecdata = response.data.responses[0].message
        statusDetails = {
          status: selecdata.order.fulfillment.state.descriptor
        }
      })
      .catch(function (error) {
        logger.error('Error is ', error)
      }) */

  return statusDetails
}

module.exports = {
  cancelAutoBooking,
  trackAutoRide,
  rateAutoRide,
  getAutoRideStatus,
  selectAutoRide,
  confirmAutoRide,
  getListOfAutosAvailable,
  getUpdates
}
