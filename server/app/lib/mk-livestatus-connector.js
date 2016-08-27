// Compiled by Babel
// ** DO NOT EDIT THIS FILE DIRECTLY **
//
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _child_process = require('child_process');

var _mkLivestatusQuery = require('./mk-livestatus-query');

var _mkLivestatusQuery2 = _interopRequireDefault(_mkLivestatusQuery);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Promise = require('bluebird');


/**
 * Connects to the MK Livestatus service and
 * retrieves status data
 *
 * http://mathias-kettner.com/checkmk_livestatus.html
 */

var MKLivestatusConnector = function () {
  function MKLivestatusConnector(nconf, logger) {
    _classCallCheck(this, MKLivestatusConnector);

    this.nconf = nconf;
    this.logger = logger;
  }

  /**
   * Returns the state of the stations
   * Returns an array of objects with shape
   * {id: 'station name', state: 0, state_type: 1,
   * app_state: 0, app_state_type: 1, app_id: 'fg app name'}
   *
   * @returns {Promise}
   * @resolve {Array}
   */


  _createClass(MKLivestatusConnector, [{
    key: 'getState',
    value: function getState() {
      var _this = this;

      this.logger.debug('MKLivestatus: Querying');
      var state = new Map();
      return this.getStationState().then(function (stations) {
        _this.logger.debug('MKLivestatus: host state response received. Updating stations.');
        var _iteratorNormalCompletion = true;
        var _didIteratorError = false;
        var _iteratorError = undefined;

        try {
          for (var _iterator = stations[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
            var station = _step.value;

            if (station.hasOwnProperty('id')) {
              state.set(station.id, station);
            }
          }
        } catch (err) {
          _didIteratorError = true;
          _iteratorError = err;
        } finally {
          try {
            if (!_iteratorNormalCompletion && _iterator.return) {
              _iterator.return();
            }
          } finally {
            if (_didIteratorError) {
              throw _iteratorError;
            }
          }
        }

        return _this.getForegroundApps();
      }).then(function (stations) {
        _this.logger.debug('MKLivestatus: app state response received. Updating stations.');
        var _iteratorNormalCompletion2 = true;
        var _didIteratorError2 = false;
        var _iteratorError2 = undefined;

        try {
          for (var _iterator2 = stations[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
            var station = _step2.value;

            if (station.hasOwnProperty('id') && state.has(station.id)) {
              var stationState = state.get(station.id);
              stationState.app_state = station.app_state;
              stationState.app_state_type = station.app_state_type;
              stationState.app_id = station.app_id;
            }
          }
        } catch (err) {
          _didIteratorError2 = true;
          _iteratorError2 = err;
        } finally {
          try {
            if (!_iteratorNormalCompletion2 && _iterator2.return) {
              _iterator2.return();
            }
          } finally {
            if (_didIteratorError2) {
              throw _iteratorError2;
            }
          }
        }

        return state.values();
      }).catch(function (err) {
        _this.logger.error('MKLivestatus: Error querying \'' + err.message + '\'');
        throw err;
      });
    }

    /**
     * Queries the state of the stations
     * Returns an array of objects with shape
     * {id: 'station name ', state: 0, state_type: 1}
     * @private
     *
     * @returns {Promise}
     * @resolve {Array}
     * @reject {Error}
     */

  }, {
    key: 'getStationState',
    value: function getStationState() {
      this.logger.debug('MKLivestatus: Querying host state');
      return this.query().get('hosts').columns(['name', 'state', 'state_type']).asColumns(['id', 'state', 'state_type']).execute();
    }

    /**
     * Queries the foreground apps running in the stations
     * Returns an array of objects with shape
     * {id: 'station name', app_state: 0, app_state_type: 1, app_id: 'app name'}
     * @private
     *
     * @returns {Promise}
     */

  }, {
    key: 'getForegroundApps',
    value: function getForegroundApps() {
      this.logger.debug('MKLivestatus: Querying app state');
      return this.query().get('services').columns(['host_name', 'state', 'state_type', 'plugin_output']).asColumns(['id', 'app_state', 'app_state_type', 'app_id']).filter('description = dockapp_top1').execute().then(function (stations) {
        var _iteratorNormalCompletion3 = true;
        var _didIteratorError3 = false;
        var _iteratorError3 = undefined;

        try {
          for (var _iterator3 = stations[Symbol.iterator](), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
            var station = _step3.value;

            // todo: replace for better regexp / parsing
            var matches = station.app_id.match(/^[^:]+:\s*(.*)@\[.*\]$/);
            if (matches !== null && matches.hasOwnProperty('length') && matches.length > 1) {
              station.app_id = matches[1];
            } else {
              if (station.app_id === 'CRIT - CRITICAL - no running TOP app!') {
                station.app_id = '';
              } else {
                throw new Error('Error parsing app_id of station ' + station.id + ': ' + station.app_id);
              }
            }
          }
        } catch (err) {
          _didIteratorError3 = true;
          _iteratorError3 = err;
        } finally {
          try {
            if (!_iteratorNormalCompletion3 && _iterator3.return) {
              _iterator3.return();
            }
          } finally {
            if (_didIteratorError3) {
              throw _iteratorError3;
            }
          }
        }

        return stations;
      });
    }

    /**
     * Creates a query
     * @private
     *
     * @returns {MKLivestatusQuery}
     */

  }, {
    key: 'query',
    value: function query() {
      return new _mkLivestatusQuery2.default(this);
    }

    /**
     * Sends a query command to MKLivestatus
     *
     * @param {String} queryString
     * @returns {Promise}
     * @resolve {Array} Response rows
     * @reject {Error}
     */

  }, {
    key: 'sendCommand',
    value: function sendCommand(queryString) {
      var _this2 = this;

      return new Promise(function (resolve) {
        var MKLivestatusCommand = _this2.nconf.get('mkls_cmd');
        _this2.logger.debug('MKLivestatus: executing query through \'' + MKLivestatusCommand + '\'');
        _this2.logger.debug('sending query \'' + queryString + '\'');
        var process = (0, _child_process.exec)(MKLivestatusCommand);

        var stdoutBuf = '';

        process.stdout.on('data', function (data) {
          stdoutBuf += data;
        }).on('end', function () {
          _this2.logger.debug('MKLivestatus stdout: \'' + stdoutBuf + '\'');
          resolve(stdoutBuf);
        });

        process.stderr.on('data', function (data) {
          _this2.logger.error('MKLivestatus stderr: ' + data);
        });

        process.stdin.end(queryString + '\n\n');
      });
    }
  }]);

  return MKLivestatusConnector;
}();

// When executed directly it performs a query


exports.default = MKLivestatusConnector;
if (require.main === module) {
  var mkLivestatusConnector = new MKLivestatusConnector();
  console.log('Querying');
  mkLivestatusConnector.getState().then(function (state) {
    console.log(state);
  });
}
//# sourceMappingURL=mk-livestatus-connector.js.map
