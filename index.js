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
const endpoint = 'https://liftmaster.thomasmunduchira.com';

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
  console.log('header', header);
  console.log('payload', payload);
  return {
    header,
    payload
  };
}

const handleDiscovery = (event) => {
  const access_token = event.payload.accessToken;
  return request({
      method: 'GET',
      uri: endpoint + '/doors',
      headers: {
        Authorization: 'Bearer ' + access_token
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

const handleControlSetState = (event) => {
  const header = createHeader(NAMESPACE_CONTROL, RESPONSE_TURN_ON);
  const payload = {};
  return createDirective(header, payload);
}

const handleControlTurnOn = (event) => {
  const header = createHeader(NAMESPACE_CONTROL, RESPONSE_TURN_ON);
  const payload = {};
  return createDirective(header, payload);
}

const handleControlTurnOff = (event) => {
  const header = createHeader(NAMESPACE_CONTROL, RESPONSE_TURN_ON);
  const payload = {};
  return createDirective(header, payload);
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
      handleControlSetState(event)
        .then((response) => {
          return response;
        });
      break;
    case REQUEST_TURN_ON:
      handleControlTurnOn(event)
        .then((response) => {
          return response;
        });
      break;
    case REQUEST_TURN_OFF:
      handleControlTurnOff(event)
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
  const header = createHeader(NAMESPACE_QUERY, RESPONSE_TURN_ON);
  return request({
      method: 'GET',
      uri: endpoint + '/api/v4/User/Validate',
      headers: {
        MyQApplicationId: appId
      },
      body: {
        username: this.username,
        password: this.password
      },
      json: true
    }).then((response) => {
      const payload = {};
      return createDirective(header, payload);
    });
}

const handleUnsupportedQueryOperation = () => {
  const header = createHeader(NAMESPACE_QUERY, ERROR_UNSUPPORTED_OPERATION);
  const payload = {};s
  return createDirective(header, payload);
}

const handleQuery = (event) => {
  const requestedName = event.header.name;
  switch (requestedName) {
    case QUERY_GET_STATE:
      handleQueryGetState(event)
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
        handleDiscovery(event)
          .then((response) => {
            callback(null, response);
          });
        break;
      case NAMESPACE_CONTROL:
        response = handleControl(event)
          .then((response) => {
            callback(null, response);
          });
        break;
      case NAMESPACE_QUERY:
        response = handleQuery(event)
          .then((response) => {
            callback(null, response);
          });
        break;
      default:
        log('Error', 'Unsupported namespace: ' + requestedNamespace);
        const response = handleUnexpectedInfo(requestedNamespace);
        callback(null, response);
        break;
    }
  } catch (error) {
    log('Error', error);
  }
}
