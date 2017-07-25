// namespaces
const NAMESPACE_DISCOVERY = 'Alexa.ConnectedHome.Discovery';
const NAMESPACE_CONTROL = 'Alexa.ConnectedHome.Control';

// discovery
const REQUEST_DISCOVER = 'DiscoverAppliancesRequest';
const RESPONSE_DISCOVER = 'DiscoverAppliancesResponse';

// control
const REQUEST_TURN_ON = 'TurnOnRequest';
const RESPONSE_TURN_ON = 'TurnOnConfirmation';
const REQUEST_TURN_OFF = 'TurnOffRequest';
const RESPONSE_TURN_OFF = 'TurnOffConfirmation';

// errors
const ERROR_UNSUPPORTED_OPERATION = 'UnsupportedOperationError';
const ERROR_UNEXPECTED_INFO = 'UnexpectedInformationReceivedError';

// support functions
const log = (title, msg) => {
  console.log('**** ' + title + ': ' + JSON.stringify(msg));
}

const createMessageId = () => {
  const d = new Date().getTime();
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
  const header = createHeader(NAMESPACE_DISCOVERY, RESPONSE_DISCOVER);
  const payload = {
    discoveredAppliances: []
  };
  return createDirective(header, payload);
}

const handleControlTurnOff = (event) => {
  const header = createHeader(NAMESPACE_CONTROL, RESPONSE_TURN_OFF);
  const payload = {};
  return createDirective(header, payload);
}

const handleControlTurnOn = (event) => {
  const header = createHeader(NAMESPACE_CONTROL, RESPONSE_TURN_ON);
  const payload = {};
  return createDirective(header, payload);
}

const handleUnsupportedOperation = () => {
  const header = createHeader(NAMESPACE_CONTROL, ERROR_UNSUPPORTED_OPERATION);
  const payload = {};
  return createDirective(header, payload);
}

const handleControl = (event) => {
  let response = null;
  const requestedName = event.header.name;
  switch (requestedName) {
    case REQUEST_TURN_ON:
      response = handleControlTurnOn(event);
      break;
    case REQUEST_TURN_OFF:
      response = handleControlTurnOff(event);
      break;
    default:
      log('Error', 'Unsupported operation' + requestedName);
      response = handleUnsupportedOperation();
      break;
  }
  return response;
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
  let response = null;
  try {
    switch (requestedNamespace) {
      case NAMESPACE_DISCOVERY:
        response = handleDiscovery(event);
        break;
      case NAMESPACE_CONTROL:
        response = handleControl(event);
        break;
      default:
        log('Error', 'Unsupported namespace: ' + requestedNamespace);
        response = handleUnexpectedInfo(requestedNamespace);
        break;
    }
  } catch (error) {
    log('Error', error);
  }
  callback(null, response);
}
