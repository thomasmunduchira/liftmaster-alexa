const request = require('request-promise-native');

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
const ERROR_EXPIRED_ACCESS_TOKEN = 'ExpiredAccessTokenError';

// API
const endpoint = 'https://myq.thomasmunduchira.com';

// support functions
const log = (title, message) => {
  console.log(`**** ${title}:`, JSON.stringify(message));
};

const createMessageId = () => {
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
  messageId: createMessageId(),
  namespace,
  name,
  payloadVersion: '2',
});

const createDirective = (header, payload) => ({
  header,
  payload,
});

const handleUnsupportedOperation = (callback) => {
  log('UnsupportedOperation', {});
  const header = createHeader(NAMESPACE_CONTROL, ERROR_UNSUPPORTED_OPERATION);
  const payload = {};
  const directive = createDirective(header, payload);
  return callback(null, directive);
};

const handleUnexpectedInfo = (fault, callback) => {
  log('UnexpectedInfo', {});
  const header = createHeader(NAMESPACE_CONTROL, ERROR_UNEXPECTED_INFO);
  const payload = {
    faultingParameter: fault,
  };
  const directive = createDirective(header, payload);
  return callback(null, directive);
};

const handleExpiredAccessToken = (callback) => {
  log('ExpiredAccessToken', {});
  const header = createHeader(NAMESPACE_CONTROL, ERROR_EXPIRED_ACCESS_TOKEN);
  const payload = {};
  const directive = createDirective(header, payload);
  return callback(null, directive);
};

const errorHandler = (returnCode, callback) => {
  log(`ErrorHandler: ${returnCode}`, {});
  if ([14, 17].includes(returnCode)) {
    return handleExpiredAccessToken(callback);
  }
  return callback(null, null);
};

const handleDiscovery = (event, callback) => {
  const {
    accessToken,
  } = event.payload;

  const requestOptions = {
    method: 'GET',
    uri: `${endpoint}/devices`,
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    json: true,
  };
  return request(requestOptions)
    .then((result) => {
      const {
        returnCode,
        devices,
      } = result;

      if (returnCode !== 0) {
        return errorHandler(returnCode, callback);
      }

      const discoveredAppliances = [];
      let index = 1;
      for (const device of devices) {
        if (!device.id) {
          continue;
        }

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

        const deviceName = device.name ? device.name : `Device ${index}`;
        const typeId = device.typeId ? device.typeId : 'Unknown';
        const typeName = device.typeName ? device.typeName : 'MyQ Device';
        const online = device.online === true;

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
      log('DISCOVER', discoveredAppliances);
      const header = createHeader(NAMESPACE_DISCOVERY, RESPONSE_DISCOVER);
      const payload = {
        discoveredAppliances,
      };
      const directive = createDirective(header, payload);
      return callback(null, directive);
    })
    .catch((err) => {
      log('handleDiscovery - Error', err);
    });
};


const setState = (accessToken, id, typeId, state) => {
  let type;
  console.log('SETTING STATE', typeId, id, state);
  if (typeId === '3') {
    type = 'light';
  } else {
    type = 'door';
    if (state === 1) {
      return handleUnsupportedOperation();
    }
  }

  const requestOptions = {
    method: 'PUT',
    uri: `${endpoint}/${type}/state`,
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: {
      id,
      state,
    },
    json: true,
  };
  return request(requestOptions)
    .catch((err) => {
      log('setState - Error', err);
    });
};

const handleControlSetState = (event, callback) => {
  const {
    accessToken,
    appliance,
    lockState,
  } = event.payload;
  const state = lockState === 'LOCKED' ? 0 : 1;

  return setState(accessToken, appliance.applianceId, appliance.additionalApplianceDetails.typeId, state)
    .then((result) => {
      log('CHANGE', result);
      const {
        returnCode,
      } = result;

      if (returnCode !== 0) {
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
    });
};

const handleControlTurnOn = (event, callback) => {
  const {
    accessToken,
    appliance,
  } = event.payload;

  return setState(accessToken, appliance.applianceId, appliance.additionalApplianceDetails.typeId, 1)
    .then((result) => {
      log('OPEN', result);
      const {
        returnCode,
      } = result;

      if (returnCode !== 0) {
        return errorHandler(returnCode, callback);
      }

      const header = createHeader(NAMESPACE_CONTROL, RESPONSE_TURN_ON);
      const payload = {};
      const directive = createDirective(header, payload);
      return callback(null, directive);
    })
    .catch((err) => {
      log('handleControlTurnOn - Error', err);
    });
};

const handleControlTurnOff = (event, callback) => {
  const {
    accessToken,
    appliance,
  } = event.payload;

  return setState(accessToken, appliance.applianceId, appliance.additionalApplianceDetails.typeId, 0)
    .then((result) => {
      log('CLOSE', result);
      const {
        returnCode,
      } = result;

      if (returnCode !== 0) {
        return errorHandler(returnCode, callback);
      }

      const header = createHeader(NAMESPACE_CONTROL, RESPONSE_TURN_OFF);
      const payload = {};
      const directive = createDirective(header, payload);
      return callback(null, directive);
    })
    .catch((err) => {
      log('handleControlTurnOff - Error', err);
    });
};

const handleControl = (event, callback) => {
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
  const {
    accessToken,
    appliance,
  } = event.payload;

  const requestOptions = {
    method: 'GET',
    uri: `${endpoint}/door/state`,
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    qs: {
      id: appliance.applianceId,
    },
    json: true,
  };
  return request(requestOptions)
    .then((result) => {
      const {
        returnCode,
        doorState,
      } = result;

      if (returnCode !== 0) {
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
    });
};

const handleQuery = (event, callback) => {
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

  return callback(null, null);
};
