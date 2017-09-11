const constants = require('../config/constants');
const response = require('./response');
const utils = require('./utils');

const errors = {
  handleUnsupportedOperation(callback) {
    // in case operation is not supported or not allowed
    utils.log('UnsupportedOperation', {});
    const header = response.createHeader(
      constants.NAMESPACE_CONTROL,
      constants.ERROR_UNSUPPORTED_OPERATION
    );
    const payload = {};
    const directive = response.createDirective(header, payload);
    return callback(null, directive);
  },
  handleUnexpectedInfo(fault, callback) {
    // in case a request with unexpected info comes through
    utils.log('UnexpectedInfo', {});
    const header = response.createHeader(
      constants.NAMESPACE_CONTROL,
      constants.ERROR_UNEXPECTED_INFO
    );
    const payload = {
      faultingParameter: fault,
    };
    const directive = response.createDirective(header, payload);
    return callback(null, directive);
  },
  handleInvalidAccessToken(callback) {
    // in case user access token is invalid/expired
    utils.log('InvalidAccessToken', {});
    const header = response.createHeader(
      constants.NAMESPACE_CONTROL,
      constants.ERROR_INVALID_ACCESS_TOKEN
    );
    const payload = {};
    const directive = response.createDirective(header, payload);
    return callback(null, directive);
  },
  handleDependentServiceUnavailable(callback) {
    // in case MyQ service is down
    utils.log('DependentServiceUnavailable', {});
    const header = response.createHeader(
      constants.NAMESPACE_CONTROL,
      constants.ERROR_DEPENDENT_SERVICE_UNAVAILABLE
    );
    const payload = {
      dependentServiceName: 'MyQ Service',
    };
    const directive = response.createDirective(header, payload);
    return callback(null, directive);
  },
};

module.export = errors;
