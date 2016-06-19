// Compiled by Babel
// ** DO NOT EDIT THIS FILE DIRECTLY **
//
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var testStations = require('../../tests/models/test_stations.json');
var iconmap = require('../../iconmap.json');
var EventEmitter = require('events').EventEmitter;

/**
 * Service Layer to the DockApp system
 * Dispatches requests asynchronously and keeps cached state
 */

var StationManager = function () {

  /**
   * Create a Station Manager
   *
   * @param {Object} config - Instance of nconf configuration
   * @param {Object} logger - Instance of winston logger
   * @param {DockAppConnector} connector - DockApp connector
   */

  function StationManager(config, logger, connector) {
    _classCallCheck(this, StationManager);

    this.config = config;
    this.logger = logger;
    this.connector = connector;
    this.stations = testStations;
    this.events = new EventEmitter();
    var _iteratorNormalCompletion = true;
    var _didIteratorError = false;
    var _iteratorError = undefined;

    try {
      for (var _iterator = this.stations[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
        var station = _step.value;

        station.icon = this.getIconURL(station.app);
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

    this.logEntries = [];
  }

  /**
   * Return the list of stations
   */


  _createClass(StationManager, [{
    key: 'getStations',
    value: function getStations() {
      return this.stations;
    }

    /**
     * Start indicated stations
     *
     * @todo Change interface to return a promise
     * @param {iterable} stationIDs - IDs of stations to start
     */

  }, {
    key: 'startStations',
    value: function startStations(stationIDs) {
      var _this = this;

      var _iteratorNormalCompletion2 = true;
      var _didIteratorError2 = false;
      var _iteratorError2 = undefined;

      try {
        var _loop = function _loop() {
          var stationID = _step2.value;

          var station = _this.getStationByID(stationID);
          if (station) {
            if (station.state === 'off') {
              station.state = 'busy';
              station.status = 'Starting...';
              _this.connector.startStation(stationID).then(function () {
                station.state = 'on';
                station.status = '';
                _this.log('message', station, 'Station started');
              }).catch(function () {
                station.state = 'error';
                station.status = 'Failure starting the station';
                _this.log('error', station, 'Error starting station');
              }).then(function () {
                _this.signalUpdate();
              });
            }
          }
        };

        for (var _iterator2 = stationIDs[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
          _loop();
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

      this.signalUpdate();
    }

    /**
     * Stop indicated stations
     *
     * @todo Change interface to return a promise
     * @param {iterable} stationIDs - IDs of stations to stop
     */

  }, {
    key: 'stopStations',
    value: function stopStations(stationIDs) {
      var _this2 = this;

      var _iteratorNormalCompletion3 = true;
      var _didIteratorError3 = false;
      var _iteratorError3 = undefined;

      try {
        var _loop2 = function _loop2() {
          var stationID = _step3.value;

          var station = _this2.getStationByID(stationID);
          if (station) {
            if (station.state === 'on') {
              station.state = 'busy';
              station.status = 'Stopping...';

              _this2.connector.stopStation(stationID).then(function () {
                station.state = 'off';
                station.status = '';
                _this2.log('message', station, 'Station stopped');
              }).catch(function () {
                station.state = 'error';
                station.status = 'Failure stopping the station';
                _this2.log('error', station, 'Error stopping station');
              }).then(function () {
                _this2.signalUpdate();
              });
            }
          }
        };

        for (var _iterator3 = stationIDs[Symbol.iterator](), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
          _loop2();
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

      this.signalUpdate();
    }

    /**
     * Change the application running in indicated stations
     *
     * @todo Change interface to return a promise
     * @param {iterable} stationIDs - IDs of stations in which to change the appID
     * @param {string} appID - Name of the appID to run
     */

  }, {
    key: 'changeApp',
    value: function changeApp(stationIDs, appID) {
      var _this3 = this;

      var _iteratorNormalCompletion4 = true;
      var _didIteratorError4 = false;
      var _iteratorError4 = undefined;

      try {
        var _loop3 = function _loop3() {
          var stationID = _step4.value;

          var station = _this3.getStationByID(stationID);
          if (station) {
            if (station.state === 'on') {
              station.state = 'busy';
              station.status = 'Switching to ' + appID + '...';
              station.app = '';

              _this3.connector.changeApp(stationID, appID).then(function () {
                station.app = appID;
                station.icon = _this3.getIconURL(appID);
                station.state = 'on';
                station.status = '';
                _this3.log('message', station, 'Launched app ' + appID);
              }).catch(function () {
                station.app = appID;
                station.icon = _this3.getIconURL(appID);
                station.state = 'error';
                station.status = 'Failure launching appID';
                _this3.log('error', station, 'Failed to launch app ' + appID);
              }).then(function () {
                _this3.signalUpdate();
              });
            }
          }
        };

        for (var _iterator4 = stationIDs[Symbol.iterator](), _step4; !(_iteratorNormalCompletion4 = (_step4 = _iterator4.next()).done); _iteratorNormalCompletion4 = true) {
          _loop3();
        }
      } catch (err) {
        _didIteratorError4 = true;
        _iteratorError4 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion4 && _iterator4.return) {
            _iterator4.return();
          }
        } finally {
          if (_didIteratorError4) {
            throw _iteratorError4;
          }
        }
      }

      this.signalUpdate();
    }

    /**
     * Return the URL of the icon of the specified app
     *
     * @param {string} appID - ID of the app
     * @returns {string} - URL of the icon
     */

  }, {
    key: 'getIconURL',
    value: function getIconURL(appID) {
      if (iconmap[appID] !== undefined) {
        return 'icons/' + iconmap[appID];
      }
      return 'icons/none.png';
    }

    /**
     * Return the station activity log
     *
     * Each log entry is an object with the following structure:
     * - id {string} : Unique id of the entry
     * - time {string} : Timestamp in ISO format
     * - type {string} : info | warning | error
     * - message {string} : Event description
     *
     * @todo Change return type to array and wrap on Controller
     * @returns {{entries: (Array)}}
     */

  }, {
    key: 'getLog',
    value: function getLog() {
      return { entries: this.logEntries };
    }

    /**
     * Logs an event
     *
     * @param {string} type - Event type: info | warning | error
     * @param {string|null} station - station associated with the event logged
     * @param {string} message - Message to log
     */

  }, {
    key: 'log',
    value: function log(type, station, message) {
      var newLogEntry = {
        id: this.logEntries.length + 1,
        time: new Date().toISOString(),
        type: type,
        message: message
      };

      if (station !== null) {
        newLogEntry.station_id = station.id;
        newLogEntry.station_name = station.name;
      }

      this.logEntries.push(newLogEntry);

      var maxEntries = this.config.get('max_log_length');
      if (this.logEntries.length > maxEntries) {
        this.logEntries = this.logEntries.slice(this.logEntries.length - maxEntries);
      }
    }

    /**
     * Return the event emitter
     *
     * @returns {EventEmitter}
     */

  }, {
    key: 'getEvents',
    value: function getEvents() {
      return this.events;
    }

    /**
     * Return a station identified by ID
     * @private
     *
     * @todo Fix symmetry with getStations as this method uses the cached state
     * @param {string} id - Station ID
     * @returns {*}
     */

  }, {
    key: 'getStationByID',
    value: function getStationByID(id) {
      var _iteratorNormalCompletion5 = true;
      var _didIteratorError5 = false;
      var _iteratorError5 = undefined;

      try {
        for (var _iterator5 = this.stations[Symbol.iterator](), _step5; !(_iteratorNormalCompletion5 = (_step5 = _iterator5.next()).done); _iteratorNormalCompletion5 = true) {
          var _station = _step5.value;

          if (_station.id === id) {
            return _station;
          }
        }
      } catch (err) {
        _didIteratorError5 = true;
        _iteratorError5 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion5 && _iterator5.return) {
            _iterator5.return();
          }
        } finally {
          if (_didIteratorError5) {
            throw _iteratorError5;
          }
        }
      }

      return null;
    }

    /**
     * Signal listeners that station data was modified
     * @private
     */

  }, {
    key: 'signalUpdate',
    value: function signalUpdate() {
      this.getEvents().emit('stationUpdate');
    }
  }]);

  return StationManager;
}();

exports.default = StationManager;
//# sourceMappingURL=station-manager.js.map
