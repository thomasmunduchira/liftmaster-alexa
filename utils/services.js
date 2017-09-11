const request = require('request-promise-native');

const constants = require('../config/constants');
const errors = require('./errors');
const utils = require('./utils');

const services = {
  errorHandler(returnCode, callback) {
    // error handler for all requests going to endpoint
    utils.log(`ErrorHandler: ${returnCode}`, {});
    if ([14, 16, 17].includes(returnCode)) {
      // 14, 16, 17 all mean invalid access token
      return errors.handleInvalidAccessToken(callback);
    }

    // default error
    return errors.handleDependentServiceUnavailable(callback);
  },
  discover(accessToken) {
    const requestOptions = {
      method: 'GET',
      uri: `${constants.endpoint}/devices`,
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      json: true,
      timeout: constants.requestTimeout,
    };
    return request(requestOptions)
      .then(result => {
        const discoveredAppliances = [];
        if (result) {
          let { devices } = result;
          devices = devices || [];

          let index = 1;
          for (const device of devices) {
            if (!device.id) {
              // all devices should have IDs
              continue;
            }

            // generate possible actions for device
            let applianceTypes;
            let actions = ['turnOff'];
            if (device.typeId === 3) {
              actions = actions.concat(['turnOn']);
              applianceTypes = ['LIGHT'];
            } else {
              applianceTypes = ['SMARTLOCK', 'SWITCH'];
              actions = actions.concat(['getLockState', 'setLockState']);
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
        return discoveredAppliances;
      })
      .catch(err => {
        // discovery should never return an error: https://developer.amazon.com/public/solutions/alexa/alexa-skills-kit/docs/smart-home-skill-api-reference#discovery-messages
        utils.log('handleDiscovery - Error', err);
        return [];
      });
  },
  getState(accessToken, appliance, callback) {
    const requestOptions = {
      method: 'GET',
      uri: `${constants.endpoint}/door/state`,
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      qs: {
        id: appliance.applianceId,
      },
      json: true,
      timeout: constants.requestTimeout,
    };
    return request(requestOptions)
      .then(result => {
        if (!result) {
          // MyQ service down
          return errors.handleDependentServiceUnavailable(callback);
        }

        const { returnCode } = result;

        if (returnCode !== 0) {
          // catch error
          return this.errorHandler(returnCode, callback);
        }

        return result;
      })
      .catch(err => {
        utils.log('getState - Error', err);
        return errors.handleDependentServiceUnavailable(callback);
      });
  },
  setState(accessToken, appliance, state, callback) {
    // finds type of device
    let type;
    if (appliance.additionalApplianceDetails.typeId === '3') {
      type = 'light';
    } else {
      type = 'door';
      if (state === 1) {
        // doors cannot be opened through this skill due to a lack of pin support for smart home skills
        return errors.handleUnsupportedOperation(callback);
      }
    }

    const requestOptions = {
      method: 'PUT',
      uri: `${constants.endpoint}/${type}/state`,
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: {
        id: appliance.applianceId,
        state,
      },
      json: true,
      timeout: constants.requestTimeout,
    };
    return request(requestOptions)
      .then(result => {
        if (!result) {
          // MyQ service down
          return errors.handleDependentServiceUnavailable(callback);
        }

        const { returnCode } = result;

        if (returnCode !== 0) {
          // catch error
          return this.errorHandler(returnCode, callback);
        }

        return result;
      })
      .catch(err => {
        utils.log('setState - Error', err);
        return errors.handleDependentServiceUnavailable(callback);
      });
  },
};

module.exports = services;
