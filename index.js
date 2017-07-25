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

// query
const REQUEST_GET_STATE = 'GetLockStateRequest';
const RESPONSE_GET_STATE = 'GetLockStateResponse';

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

const handleControlSetState = (event) => {
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
  let response = null;
  const requestedName = event.header.name;
  switch (requestedName) {
    case REQUEST_SET_STATE:
      response = handleControlSetState(event);
      break;
    default:
      log('Error', 'Unsupported operation' + requestedName);
      response = handleUnsupportedControlOperation();
      break;
  }
  return response;
}

const handleQueryGetState = (event) => {
  const header = createHeader(NAMESPACE_QUERY, RESPONSE_TURN_ON);
  const payload = {};
  return createDirective(header, payload);
}

const handleUnsupportedQueryOperation = () => {
  const header = createHeader(NAMESPACE_QUERY, ERROR_UNSUPPORTED_OPERATION);
  const payload = {};s
  return createDirective(header, payload);
}

const handleQuery = (event) => {
  let response = null;
  const requestedName = event.header.name;
  switch (requestedName) {
    case QUERY_GET_STATE:
      response = handleQueryGetState(event);
      break;
    default:
      log('Error', 'Unsupported operation' + requestedName);
      response = handleUnsupportedQueryOperation();
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
      case NAMESPACE_QUERY:
        response = handleQuery(event);
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
