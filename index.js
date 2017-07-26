const request = require('request-promise-native');

// namespaces
const NAMESPACE_DISCOVERY = 'Alexa.ConnectedHome.Discovery';
const NAMESPACE_CONTROL = 'Alexa.ConnectedHome.Control';
const NAMESPACE_QUERY = 'Alexa.ConnectedHome.Query';

// discovery
const REQUEST_DISCOVER = 'DiscoverAppliancesRequest';
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

// API
const endpoint = 'https://myq.thomasmunduchira.com';

// support functions
const log = (title, msg) => {
  console.log('**** ' + title + ': ' + JSON.stringify(msg));
}

const createMessageId = () => {
  let d = new Date().getTime();
  const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (d + Math.random() * 16) % 16 | 0;
    d = Math.floor(d / 16);
    return (c == 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
  return uuid;
}

const createHeader = (namespace, name) => {
  return {
    messageId: createMessageId(),
    namespace,
    name,
    payloadVersion: '2'
  };
}

const createDirective = (header, payload) => {
  return {
    header,
    payload
  };
}

const handleDiscovery = (event) => {
  const { accessToken } = event.payload;
  return request({
      method: 'GET',
      uri: endpoint + '/doors',
      headers: {
        Authorization: 'Bearer ' + accessToken
      },
      json: true
    }).then((result) => {
      const { returnCode, doors, error } = result;
      if (returnCode === 0) {
        const discoveredAppliances = [];
        for (let door of doors) {
          const discoveredAppliance = {
            applianceTypes: [
               'SMARTLOCK',
               'SWITCH'
            ],
            applianceId: door.id,
            manufacturerName: 'LiftMaster',
            modelName: door.type,
            version: '1.00',
            friendlyName: door.name,
            friendlyDescription: door.type,
            isReachable: true,
            actions: [
              'getLockState',
              'setLockState',
              'turnOff',
              'turnOn'
            ],
            additionalApplianceDetails: {}
          };
          discoveredAppliances.push(discoveredAppliance);
        }
        const header = createHeader(NAMESPACE_DISCOVERY, RESPONSE_DISCOVER);
        const payload = {
          discoveredAppliances
        };
        return createDirective(header, payload);
      }
    }).catch((err) => {
      console.log('handleDiscovery - Error', err);
    });
}

const setState = (accessToken, id, state) => {
  return request({
      method: 'PUT',
      uri: endpoint + '/door/state',
      headers: {
        Authorization: 'Bearer ' + accessToken
      },
      body: {
        id,
        state
      },
      json: true
    }).then((result) => {
      return result;
    }).catch((err) => {
      console.log('setState - Error', err);
    });
}

const handleControlSetState = (event) => {
  const { accessToken, appliance, lockState } = event.payload;
  const state = lockState === 'LOCKED' ? 0 : 1;
  return setState(accessToken, appliance.applianceId, state)
    .then((result) => {
      if (result.returnCode === 0) {
        const header = createHeader(NAMESPACE_CONTROL, RESPONSE_SET_STATE);
        const payload = {
          lockState
        };
        return createDirective(header, payload);
      }
    });
}

const handleControlTurnOn = (event) => {
  const { accessToken, appliance } = event.payload;
  return setState(accessToken, appliance.applianceId, 1)
    .then((result) => {
      if (result.returnCode === 0) {
        const header = createHeader(NAMESPACE_CONTROL, RESPONSE_TURN_ON);
        const payload = {};
        return createDirective(header, payload);
      }
    });
}

const handleControlTurnOff = (event) => {
  const { accessToken, appliance } = event.payload;
  return setState(accessToken, appliance.applianceId, 0)
    .then((result) => {
      if (result.returnCode === 0) {
        const header = createHeader(NAMESPACE_CONTROL, RESPONSE_TURN_OFF);
        const payload = {};
        return createDirective(header, payload);
      }
    });
}

const handleUnsupportedControlOperation = () => {
  const header = createHeader(NAMESPACE_CONTROL, ERROR_UNSUPPORTED_OPERATION);
  const payload = {};
  return createDirective(header, payload);
}

const handleControl = (event) => {
  const requestedName = event.header.name;
  switch (requestedName) {
    case REQUEST_SET_STATE:
      return handleControlSetState(event)
        .then((response) => {
          return response;
        });
      break;
    case REQUEST_TURN_ON:
      return handleControlTurnOn(event)
        .then((response) => {
          return response;
        });
      break;
    case REQUEST_TURN_OFF:
      return handleControlTurnOff(event)
        .then((response) => {
          return response;
        });
      break;
    default:
      log('Error', 'Unsupported operation' + requestedName);
      const response = handleUnsupportedControlOperation();
      return response;
      break;
  }
}

const handleQueryGetState = (event) => {
  const { accessToken, appliance } = event.payload;
  return request({
      method: 'GET',
      uri: endpoint + '/door/state',
      headers: {
        Authorization: 'Bearer ' + accessToken
      },
      qs: {
        id: appliance.applianceId
      },
      json: true
    }).then((result) => {
      const { returnCode, state, error } = result;
      if (returnCode === 0) {
        const header = createHeader(NAMESPACE_QUERY, RESPONSE_GET_STATE);
        const payload = {
          lockState: state === 2 ? 'LOCKED' : 'UNLOCKED'
        };
        return createDirective(header, payload);
      }
    }).catch((err) => {
      console.log('handleQueryGetState - Error', err);
    });
}

const handleUnsupportedQueryOperation = () => {
  const header = createHeader(NAMESPACE_QUERY, ERROR_UNSUPPORTED_OPERATION);
  const payload = {};
  return createDirective(header, payload);
}

const handleQuery = (event) => {
  const requestedName = event.header.name;
  switch (requestedName) {
    case REQUEST_GET_STATE:
      return handleQueryGetState(event)
        .then((response) => {
          return response;
        });
      break;
    default:
      log('Error', 'Unsupported operation' + requestedName);
      const response = handleUnsupportedQueryOperation();
      return response;
      break;
  }
}

const handleUnexpectedInfo = (fault) => {
  const header = createHeader(NAMESPACE_CONTROL, ERROR_UNEXPECTED_INFO);
  const payload = {
    faultingParameter: fault
  };
  return createDirective(header, payload);
}

// entry
exports.handler = (event, context, callback) => {
  log('Received Directive', event);
  const requestedNamespace = event.header.namespace;
  try {
    switch (requestedNamespace) {
      case NAMESPACE_DISCOVERY:
        return handleDiscovery(event)
          .then((response) => {
            console.log(response);
            return callback(null, response);
          });
        break;
      case NAMESPACE_CONTROL:
        return handleControl(event)
          .then((response) => {
            console.log(response);
            return callback(null, response);
          });
        break;
      case NAMESPACE_QUERY:
        return handleQuery(event)
          .then((response) => {
            console.log(response);
            return callback(null, response);
          });
        break;
      default:
        log('Error', 'Unsupported namespace: ' + requestedNamespace);
        const response = handleUnexpectedInfo(requestedNamespace);
        return callback(null, response);
        break;
    }
  } catch (error) {
    log('Error', error);
  }
}
