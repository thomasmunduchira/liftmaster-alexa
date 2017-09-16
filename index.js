const constants = require('./config/constants');
const errors = require('./utils/errors');
const response = require('./utils/response');
const services = require('./utils/services');
const utils = require('./utils/utils');

const handleDiscovery = (event, callback) => {
  // handles discovery operation
  const { accessToken } = event.payload;

  return services
    .discover(accessToken, callback)
    .then(discoveredAppliances => {
      utils.log('DISCOVER', discoveredAppliances);
      const header = response.createHeader(
        constants.NAMESPACE_DISCOVERY,
        constants.RESPONSE_DISCOVER
      );
      const payload = {
        discoveredAppliances,
      };
      const directive = response.createDirective(header, payload);
      return callback(null, directive);
    })
    .catch(err => {
      utils.log('handleDiscovery - Error', err);
      return errors.handleDependentServiceUnavailable(callback);
    });
};

const handleControlSetState = (event, callback) => {
  const { accessToken, appliance, lockState } = event.payload;
  const state = lockState === 'LOCKED' ? 0 : 1;

  return services
    .setState(accessToken, appliance, state, callback)
    .then(result => {
      utils.log('CHANGE', result);
      const header = response.createHeader(
        constants.NAMESPACE_CONTROL,
        constants.RESPONSE_SET_STATE
      );
      const payload = {
        lockState,
      };
      const directive = response.createDirective(header, payload);
      return callback(null, directive);
    })
    .catch(err => {
      utils.log('handleControlSetState - Error', err);
      return errors.handleDependentServiceUnavailable(callback);
    });
};

const handleControlTurnOn = (event, callback) => {
  const { accessToken, appliance } = event.payload;

  return services
    .setState(accessToken, appliance, 1, callback)
    .then(result => {
      utils.log('OPEN', result);
      const header = response.createHeader(constants.NAMESPACE_CONTROL, constants.RESPONSE_TURN_ON);
      const payload = {};
      const directive = response.createDirective(header, payload);
      return callback(null, directive);
    })
    .catch(err => {
      utils.log('handleControlTurnOn - Error', err);
      return errors.handleDependentServiceUnavailable(callback);
    });
};

const handleControlTurnOff = (event, callback) => {
  const { accessToken, appliance } = event.payload;

  return services
    .setState(accessToken, appliance, 0, callback)
    .then(result => {
      utils.log('CLOSE', result);
      const header = response.createHeader(
        constants.NAMESPACE_CONTROL,
        constants.RESPONSE_TURN_OFF
      );
      const payload = {};
      const directive = response.createDirective(header, payload);
      return callback(null, directive);
    })
    .catch(err => {
      utils.log('handleControlTurnOff - Error', err);
      return errors.handleDependentServiceUnavailable(callback);
    });
};

const handleControl = (event, callback) => {
  // handles control operations
  const requestedName = event.header.name;

  switch (requestedName) {
    case constants.REQUEST_SET_STATE:
      return handleControlSetState(event, callback);
    case constants.REQUEST_TURN_ON:
      return handleControlTurnOn(event, callback);
    case constants.REQUEST_TURN_OFF:
      return handleControlTurnOff(event, callback);
    default:
      utils.log(`Error: Unsupported operation ${requestedName}`, {});
      return errors.handleUnsupportedOperation(callback);
  }
};

const handleQueryGetState = (event, callback) => {
  // only doors can be queried as of this time
  const { accessToken, appliance } = event.payload;

  return services
    .getState(accessToken, appliance, callback)
    .then(result => {
      const { doorState } = result;
      const header = response.createHeader(constants.NAMESPACE_QUERY, constants.RESPONSE_GET_STATE);
      const payload = {
        lockState: doorState === 2 ? 'LOCKED' : 'UNLOCKED',
      };
      const directive = response.createDirective(header, payload);
      return callback(null, directive);
    })
    .catch(err => {
      utils.log('handleQueryGetState - Error', err);
      return errors.handleDependentServiceUnavailable(callback);
    });
};

const handleQuery = (event, callback) => {
  // handles query operations
  const requestedName = event.header.name;

  switch (requestedName) {
    case constants.REQUEST_GET_STATE:
      return handleQueryGetState(event, callback);
    default:
      utils.log(`Error: Unsupported operation ${requestedName}`, {});
      return errors.handleUnsupportedOperation(callback);
  }
};

const handleNotice = (event, callback) => errors.handleDependentServiceUnavailable(callback);

// entry
exports.handler = (event, context, callback) => {
  // handles all operations
  utils.log('Received Directive', event);
  const requestedNamespace = event.header.namespace;

  try {
    switch (requestedNamespace) {
      case constants.NAMESPACE_DISCOVERY:
        return handleNotice(event, callback);
      case constants.NAMESPACE_CONTROL:
        return handleNotice(event, callback);
      case constants.NAMESPACE_QUERY:
        return handleNotice(event, callback);
      default:
        utils.log(`Error: Unsupported namespace ${requestedNamespace}`, {});
        return errors.handleUnexpectedInfo(requestedNamespace, callback);
    }
  } catch (error) {
    utils.log('Handler - Error', error);
  }

  // in case something goes wrong
  return callback(null, null);
};
