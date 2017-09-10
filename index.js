const request = require('request-promise-native');

const config = require('./config');

// namespaces
const NAMESPACE_DISCOVERY = 'Alexa.ConnectedHome.Discovery';
const NAMESPACE_CONTROL = 'Alexa.ConnectedHome.Control';
const NAMESPACE_QUERY = 'Alexa.ConnectedHome.Query';

// discovery
const RESPONSE_DISCOVER = 'DiscoverAppliancesResponse';

// control
const REQUEST_SET_STATE = 'SetLockStateRequest';
const RESPONSE_SET_STATE = 'SetLockStateConfirmation';
const REQUEST_TURN_ON = 'TurnOnRequest';
const RESPONSE_TURN_ON = 'TurnOnConfirmation';
const REQUEST_TURN_OFF = 'TurnOffRequest';
const RESPONSE_TURN_OFF = 'TurnOffConfirmation';

// query
const REQUEST_GET_STATE = 'GetLockStateRequest';
const RESPONSE_GET_STATE = 'GetLockStateResponse';

// errors
const ERROR_UNSUPPORTED_OPERATION = 'UnsupportedOperationError';
const ERROR_UNEXPECTED_INFO = 'UnexpectedInformationReceivedError';
const ERROR_INVALID_ACCESS_TOKEN = 'InvalidAccessTokenError';
const ERROR_DEPENDENT_SERVICE_UNAVAILABLE = 'DependentServiceUnavailableError';

// support functions
const log = (title, message) => {
  // title: string, message: object
  console.log(`**** ${title}:`, JSON.stringify(message));
};

const createMessageId = () => {
  // generate random message ID
  let d = new Date()
    .getTime();
  const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (d + Math.random() * 16) % 16 | 0;
    d = Math.floor(d / 16);
    return (c === 'x' ? r : (r & 0x3 | 0x8))
      .toString(16);
  });
  return uuid;
};

const createHeader = (namespace, name) => ({
  // generate header according to what the Alexa service expects
  messageId: createMessageId(),
  namespace,
  name,
  payloadVersion: '2',
});

const createDirective = (header, payload) => ({
  // generate directive according to what the Alexa service expects
  header,
  payload,
});

const handleUnsupportedOperation = (callback) => {
  // in case operation is not supported or not allowed
  log('UnsupportedOperation', {});
  const header = createHeader(NAMESPACE_CONTROL, ERROR_UNSUPPORTED_OPERATION);
  const payload = {};
  const directive = createDirective(header, payload);
  return callback(null, directive);
};

const handleUnexpectedInfo = (fault, callback) => {
  // in case a request with unexpected info comes through
  log('UnexpectedInfo', {});
  const header = createHeader(NAMESPACE_CONTROL, ERROR_UNEXPECTED_INFO);
  const payload = {
    faultingParameter: fault,
  };
  const directive = createDirective(header, payload);
  return callback(null, directive);
};

const handleInvalidAccessToken = (callback) => {
  // in case user access token is invalid/expired
  log('InvalidAccessToken', {});
  const header = createHeader(NAMESPACE_CONTROL, ERROR_INVALID_ACCESS_TOKEN);
  const payload = {};
  const directive = createDirective(header, payload);
  return callback(null, directive);
};

const handleDependentServiceUnavailable = (callback) => {
  // in case MyQ service is down
  log('DependentServiceUnavailable', {});
  const header = createHeader(NAMESPACE_CONTROL, ERROR_DEPENDENT_SERVICE_UNAVAILABLE);
  const payload = {
    dependentServiceName: 'MyQ Service',
  };
  const directive = createDirective(header, payload);
  return callback(null, directive);
};

const errorHandler = (returnCode, callback) => {
  // error handler for all requests going to endpoint
  log(`ErrorHandler: ${returnCode}`, {});
  if ([14, 16, 17].includes(returnCode)) {
    // 14, 16, 17 all mean invalid access token
    return handleInvalidAccessToken(callback);
  }

  // default error
  return handleDependentServiceUnavailable(callback);
};

const handleDiscovery = (event, callback) => {
  // handle discovery operation
  const {
    accessToken,
  } = event.payload;

  const requestOptions = {
    method: 'GET',
    uri: `${config.endpoint}/devices`,
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    json: true,
    timeout: config.requestTimeout,
  };
  return request(requestOptions)
    .then((result) => {
      const discoveredAppliances = [];
      if (result) {
        const {
          returnCode,
          devices,
        } = result;

        if (returnCode !== 0) {
          // catch errors
          return errorHandler(returnCode, callback);
        }

        let index = 1;
        for (const device of devices) {
          if (!device.id) {
            // all devices should have IDs
            continue;
          }

          // generate possible actions for device
          let applianceTypes;
          let actions = [
            'turnOff',
          ];
          if (device.typeId === 3) {
            actions = actions.concat([
              'turnOn',
            ]);
            applianceTypes = [
              'LIGHT',
            ];
          } else {
            applianceTypes = [
              'SMARTLOCK',
              'SWITCH',
            ];
            actions = actions.concat([
              'getLockState',
              'setLockState',
            ]);
          }

          // assign default values if not found in endpoint response
          const deviceName = device.name ? device.name : `Device ${index}`;
          const typeId = device.typeId ? device.typeId : 'Unknown';
          const typeName = device.typeName ? device.typeName : 'MyQ Device';
          const online = device.online === true;

          // generate device data according to what the Alexa service expects
          const discoveredAppliance = {
            applianceTypes,
            applianceId: device.id,
            manufacturerName: 'Chamberlain/LiftMaster',
            modelName: typeName,
            version: '1.00',
            friendlyName: deviceName,
            friendlyDescription: typeName,
            isReachable: online,
            actions,
            additionalApplianceDetails: {
              typeId,
            },
          };
          if (deviceName !== device.name) {
            index += 1;
          }
          discoveredAppliances.push(discoveredAppliance);
        }
      }
      log('DISCOVER', discoveredAppliances);
      const header = createHeader(NAMESPACE_DISCOVERY, RESPONSE_DISCOVER);
      const payload = {
        discoveredAppliances,
      };
      const directive = createDirective(header, payload);
      return callback(null, directive);
    })
    .catch((err) => {
      // discovery should never return an error: https://developer.amazon.com/public/solutions/alexa/alexa-skills-kit/docs/smart-home-skill-api-reference#discovery-messages
      log('handleDiscovery - Error', err);
      const header = createHeader(NAMESPACE_DISCOVERY, RESPONSE_DISCOVER);
      const payload = {
        discoveredAppliances: [],
      };
      const directive = createDirective(header, payload);
      return callback(null, directive);
    });
};

const setState = (accessToken, id, typeId, state, callback) => {
  // find type of device
  let type;
  console.log('SETTING STATE', typeId, id, state);
  if (typeId === '3') {
    type = 'light';
  } else {
    type = 'door';
    if (state === 1) {
      // doors cannot be opened through this skill due to a lack of pin support for smart home skills
      return handleUnsupportedOperation(callback);
    }
  }

  const requestOptions = {
    method: 'PUT',
    uri: `${config.endpoint}/${type}/state`,
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: {
      id,
      state,
    },
    json: true,
    timeout: config.requestTimeout,
  };
  return request(requestOptions);
};

const handleControlSetState = (event, callback) => {
  const {
    accessToken,
    appliance,
    lockState,
  } = event.payload;
  const state = lockState === 'LOCKED' ? 0 : 1;

  return setState(accessToken, appliance.applianceId, appliance.additionalApplianceDetails.typeId, state, callback)
    .then((result) => {
      log('CHANGE', result);
      if (!result) {
        // MyQ service down
        return handleDependentServiceUnavailable(callback);
      }

      const {
        returnCode,
      } = result;

      if (returnCode !== 0) {
        // catch errors
        return errorHandler(returnCode, callback);
      }

      const header = createHeader(NAMESPACE_CONTROL, RESPONSE_SET_STATE);
      const payload = {
        lockState,
      };
      const directive = createDirective(header, payload);
      return callback(null, directive);
    })
    .catch((err) => {
      log('handleControlSetState - Error', err);
      return handleDependentServiceUnavailable(callback);
    });
};

const handleControlTurnOn = (event, callback) => {
  const {
    accessToken,
    appliance,
  } = event.payload;

  return setState(accessToken, appliance.applianceId, appliance.additionalApplianceDetails.typeId, 1, callback)
    .then((result) => {
      log('OPEN', result);
      if (!result) {
        // MyQ service down
        return handleDependentServiceUnavailable(callback);
      }

      const {
        returnCode,
      } = result;

      if (returnCode !== 0) {
        // catch errors
        return errorHandler(returnCode, callback);
      }

      const header = createHeader(NAMESPACE_CONTROL, RESPONSE_TURN_ON);
      const payload = {};
      const directive = createDirective(header, payload);
      return callback(null, directive);
    })
    .catch((err) => {
      log('handleControlTurnOn - Error', err);
      return handleDependentServiceUnavailable(callback);
    });
};

const handleControlTurnOff = (event, callback) => {
  const {
    accessToken,
    appliance,
  } = event.payload;

  return setState(accessToken, appliance.applianceId, appliance.additionalApplianceDetails.typeId, 0, callback)
    .then((result) => {
      log('CLOSE', result);
      if (!result) {
        // MyQ service down
        return handleDependentServiceUnavailable(callback);
      }

      const {
        returnCode,
      } = result;

      if (returnCode !== 0) {
        // catch errors
        return errorHandler(returnCode, callback);
      }

      const header = createHeader(NAMESPACE_CONTROL, RESPONSE_TURN_OFF);
      const payload = {};
      const directive = createDirective(header, payload);
      return callback(null, directive);
    })
    .catch((err) => {
      log('handleControlTurnOff - Error', err);
      return handleDependentServiceUnavailable(callback);
    });
};

const handleControl = (event, callback) => {
  // handles control operations
  const requestedName = event.header.name;

  switch (requestedName) {
    case REQUEST_SET_STATE:
      return handleControlSetState(event, callback);
    case REQUEST_TURN_ON:
      return handleControlTurnOn(event, callback);
    case REQUEST_TURN_OFF:
      return handleControlTurnOff(event, callback);
    default:
      log('Error', `Unsupported operation ${requestedName}`);
      return handleUnsupportedOperation(callback);
  }
};

const handleQueryGetState = (event, callback) => {
  // only doors can be queried as of this time
  const {
    accessToken,
    appliance,
  } = event.payload;

  const requestOptions = {
    method: 'GET',
    uri: `${config.endpoint}/door/state`,
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    qs: {
      id: appliance.applianceId,
    },
    json: true,
    timeout: config.requestTimeout,
  };
  return request(requestOptions)
    .then((result) => {
      if (!result) {
        // MyQ service down
        return handleDependentServiceUnavailable(callback);
      }

      const {
        returnCode,
        doorState,
      } = result;

      if (returnCode !== 0) {
        // catch errors
        return errorHandler(returnCode, callback);
      }

      const header = createHeader(NAMESPACE_QUERY, RESPONSE_GET_STATE);
      const payload = {
        lockState: doorState === 2 ? 'LOCKED' : 'UNLOCKED',
      };
      log('QUERY GET STATE', payload);
      const directive = createDirective(header, payload);
      return callback(null, directive);
    })
    .catch((err) => {
      log('handleQueryGetState - Error', err);
      return handleDependentServiceUnavailable(callback);
    });
};

const handleQuery = (event, callback) => {
  // handle query operations
  const requestedName = event.header.name;

  switch (requestedName) {
    case REQUEST_GET_STATE:
      return handleQueryGetState(event, callback);
    default:
      log('Error', `Unsupported operation ${requestedName}`);
      return handleUnsupportedOperation(callback);
  }
};

// entry
exports.handler = (event, context, callback) => {
  // handle all operations
  log('Received Directive', event);
  const requestedNamespace = event.header.namespace;

  try {
    switch (requestedNamespace) {
      case NAMESPACE_DISCOVERY:
        return handleDiscovery(event, callback);
      case NAMESPACE_CONTROL:
        return handleControl(event, callback);
      case NAMESPACE_QUERY:
        return handleQuery(event, callback);
      default:
        log('Error', `Unsupported namespace: ${requestedNamespace}`);
        return handleUnexpectedInfo(requestedNamespace, callback);
    }
  } catch (error) {
    log('Handler - Error', error);
  }

  // in case something goes wrong
  return callback(null, null);
};
