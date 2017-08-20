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

const errorHandler = (returnCode) => {

};

const handleDiscovery = (event) => {
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
      const discoveredAppliances = [];
      let index = 1;
      if (returnCode === 0) {
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
      }
      log('DISCOVER', discoveredAppliances);
      const header = createHeader(NAMESPACE_DISCOVERY, RESPONSE_DISCOVER);
      const payload = {
        discoveredAppliances,
      };
      return createDirective(header, payload);
    })
    .catch((err) => {
      log('handleDiscovery - Error', err);
    });
};

const handleUnsupportedControlOperation = () => {
  const header = createHeader(NAMESPACE_CONTROL, ERROR_UNSUPPORTED_OPERATION);
  const payload = {};
  return createDirective(header, payload);
};

const setState = (accessToken, id, typeId, state) => {
  let type;
  console.log('SETTING STATE', typeId, id, state);
  if (typeId === '3') {
    type = 'light';
  } else {
    type = 'door';
    if (state === 1) {
      return handleUnsupportedControlOperation();
    }
  }

  console.log(`${endpoint}/${type}/state`);

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

const handleControlSetState = (event) => {
  const {
    accessToken,
    appliance,
    lockState,
  } = event.payload;
  const state = lockState === 'LOCKED' ? 0 : 1;
  return setState(accessToken, appliance.applianceId, appliance.additionalApplianceDetails.typeId, state)
    .then((result) => {
      log('CHANGE', result);
      if (result.returnCode === 0) {
        const header = createHeader(NAMESPACE_CONTROL, RESPONSE_SET_STATE);
        const payload = {
          lockState,
        };
        return createDirective(header, payload);
      }
    })
    .catch((err) => {
      log('handleControlSetState - Error', err);
    });
};

const handleControlTurnOn = (event) => {
  const {
    accessToken,
    appliance,
  } = event.payload;
  return setState(accessToken, appliance.applianceId, appliance.additionalApplianceDetails.typeId, 1)
    .then((result) => {
      log('OPEN', result);
      if (result.returnCode === 0) {
        const header = createHeader(NAMESPACE_CONTROL, RESPONSE_TURN_ON);
        const payload = {};
        return createDirective(header, payload);
      }
    })
    .catch((err) => {
      log('handleControlTurnOn - Error', err);
    });
};

const handleControlTurnOff = (event) => {
  const {
    accessToken,
    appliance,
  } = event.payload;
  return setState(accessToken, appliance.applianceId, appliance.additionalApplianceDetails.typeId, 0)
    .then((result) => {
      log('CLOSE', result);
      if (result.returnCode === 0) {
        const header = createHeader(NAMESPACE_CONTROL, RESPONSE_TURN_OFF);
        const payload = {};
        return createDirective(header, payload);
      }
    })
    .catch((err) => {
      log('handleControlTurnOff - Error', err);
    });
};

const handleControl = (event) => {
  const requestedName = event.header.name;
  switch (requestedName) {
    case REQUEST_SET_STATE:
      return handleControlSetState(event);
    case REQUEST_TURN_ON:
      return handleControlTurnOn(event);
    case REQUEST_TURN_OFF:
      return handleControlTurnOff(event);
    default:
      log('Error', `Unsupported operation ${requestedName}`);
      const response = handleUnsupportedControlOperation();
      return response;
  }
};

const handleQueryGetState = (event) => {
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
      if (returnCode === 0) {
        const header = createHeader(NAMESPACE_QUERY, RESPONSE_GET_STATE);
        const payload = {
          lockState: doorState === 2 ? 'LOCKED' : 'UNLOCKED',
        };
        log('QUERY GET STATE', payload);
        return createDirective(header, payload);
      }
      return errorHandler(returnCode);
    })
    .catch((err) => {
      log('handleQueryGetState - Error', err);
    });
};

const handleUnsupportedQueryOperation = () => {
  const header = createHeader(NAMESPACE_QUERY, ERROR_UNSUPPORTED_OPERATION);
  const payload = {};
  return createDirective(header, payload);
};

const handleQuery = (event) => {
  const requestedName = event.header.name;
  switch (requestedName) {
    case REQUEST_GET_STATE:
      return handleQueryGetState(event);
    default:
      log('Error', `Unsupported operation ${requestedName}`);
      const response = handleUnsupportedQueryOperation();
      return response;
  }
};

const handleUnexpectedInfo = (fault) => {
  const header = createHeader(NAMESPACE_CONTROL, ERROR_UNEXPECTED_INFO);
  const payload = {
    faultingParameter: fault,
  };
  return createDirective(header, payload);
};

// entry
exports.handler = (event, context, callback) => {
  log('Received Directive', event);
  const requestedNamespace = event.header.namespace;
  try {
    switch (requestedNamespace) {
      case NAMESPACE_DISCOVERY:
        return handleDiscovery(event);
      case NAMESPACE_CONTROL:
        return handleControl(event);
      case NAMESPACE_QUERY:
        return handleQuery(event);
      default:
        log('Error', `Unsupported namespace: ${requestedNamespace}`);
        const response = handleUnexpectedInfo(requestedNamespace);
        return callback(null, response);
    }
  } catch (error) {
    log('Handler - Error', error);
  }
};
