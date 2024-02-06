const httpStatus = require('http-status')
const catchAsync = require('../utils/catchAsync')
const { bppService, historyService, nammaYatriService, amnexService } = require('../services')

const getAllModals = catchAsync(async (req, res) => {
  const routes = await bppService.getAllModals(req.user, req.body)
  res.status(httpStatus.OK).send(routes)
})

const selectRide = catchAsync(async (req, res) => {
  const routes = await bppService.selectRide(req.user, req.body)
  res.status(httpStatus.OK).send(routes)
})

const confirmRide = catchAsync(async (req, res) => {
  const routes = await bppService.confirmRide(req.user, req.body)
  res.status(httpStatus.OK).send(routes)
})

const cancelRide = catchAsync(async (req, res) => {
  const routes = await nammaYatriService.cancelAutoBooking(req.user, req.body)
  res.status(httpStatus.OK).send(routes)
})

const trackRide = catchAsync(async (req, res) => {
  const routes = await nammaYatriService.trackAutoRide(req.user, req.body)
  res.status(httpStatus.OK).send(routes)
})

const rateRide = catchAsync(async (req, res) => {
  req.body.feedBackScreenDisplayed = 1
  await historyService.updateFeedback(req.user, req.body)
  res.status(httpStatus.OK).send({ message: 'Feedback Updated' })
})

const rideStatus = catchAsync(async (req, res) => {
  const routes = await nammaYatriService.getAutoRideStatus(req.user, req.body)
  res.status(httpStatus.OK).send(routes)
})

const getRideHistory = catchAsync(async (req, res) => {
  const rides = await historyService.getHistoryByUser(req.user.id)
  res.status(httpStatus.OK).send(rides)
})

const bookBusTicket = catchAsync(async (req, res) => {
  const rides = await bppService.bookBusTicket(req.user, req.body)
  res.status(httpStatus.OK).send(rides)
})

const getUpdates = catchAsync(async (req, res) => {
  const rides = await nammaYatriService.getUpdates(req.user, req.body)
  res.status(httpStatus.OK).send(rides)
})

const getRidesStatusList = catchAsync(async (req, res) => {
  const rides = await historyService.getRidesList(req.user)
  res.status(httpStatus.OK).send(rides)
})

const updateBusStatus = catchAsync(async (req, res) => {
  const rides = await historyService.updateBusRideStatus(req.user, req.body)
  res.status(httpStatus.OK).send(rides)
})


//Sending hard coded values TODO - Integrate with get api when available
const getBusAlternates = catchAsync(async (req, res) => {
  const alternates = [
    {
      routeNo: '1234',
      startTime: '10:50 AM',
      endTime: '11:30 AM'
    },
    {
      routeNo: '2345',
      startTime: '10:55 AM',
      endTime: '11:35 AM'
    },
    {
      routeNo: '3456',
      startTime: '11:00 AM',
      endTime: '11:30 AM'
    },
    {
      routeNo: '5634',
      startTime: '11:15 AM',
      endTime: '11:45 AM'
    }, {
      routeNo: '5567',
      startTime: '11:30 AM',
      endTime: '12:10 PM'
    }

  ]
  //  const rides = await historyService.updateBusRideStatus(req.user, req.body)
  res.status(httpStatus.OK).send(alternates)
})

const setModeType = catchAsync(async (req, res) => {
  await amnexService.updateModeType(req.query)
  res.sendStatus(httpStatus.OK)
})

module.exports = {
  getAllModals,
  selectRide,
  confirmRide,
  cancelRide,
  trackRide,
  rideStatus,
  rateRide,
  getRideHistory,
  bookBusTicket,
  getUpdates,
  getRidesStatusList,
  updateBusStatus,
  getBusAlternates,
  setModeType
}
