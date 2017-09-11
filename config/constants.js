const constants = {
  // endpoint
  requestTimeout: 2250,
  endpoint: 'https://myq.thomasmunduchira.com',

  // namespaces
  NAMESPACE_DISCOVERY: 'Alexa.ConnectedHome.Discovery',
  NAMESPACE_CONTROL: 'Alexa.ConnectedHome.Control',
  NAMESPACE_QUERY: 'Alexa.ConnectedHome.Query',

  // discovery
  RESPONSE_DISCOVER: 'DiscoverAppliancesResponse',

  // control
  REQUEST_SET_STATE: 'SetLockStateRequest',
  RESPONSE_SET_STATE: 'SetLockStateConfirmation',
  REQUEST_TURN_ON: 'TurnOnRequest',
  RESPONSE_TURN_ON: 'TurnOnConfirmation',
  REQUEST_TURN_OFF: 'TurnOffRequest',
  RESPONSE_TURN_OFF: 'TurnOffConfirmation',

  // query
  REQUEST_GET_STATE: 'GetLockStateRequest',
  RESPONSE_GET_STATE: 'GetLockStateResponse',

  // errors
  ERROR_UNSUPPORTED_OPERATION: 'UnsupportedOperationError',
  ERROR_UNEXPECTED_INFO: 'UnexpectedInformationReceivedError',
  ERROR_INVALID_ACCESS_TOKEN: 'InvalidAccessTokenError',
  ERROR_DEPENDENT_SERVICE_UNAVAILABLE: 'DependentServiceUnavailableError',
};

module.exports = constants;
