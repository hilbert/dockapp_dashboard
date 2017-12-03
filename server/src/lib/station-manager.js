const Promise = require('bluebird');
const EventEmitter = require('events').EventEmitter;

import Station from './station';
import TerminalOutputBuffer from './terminal-output-buffer';

/**
 * Service Layer for hilbert
 * Dispatches requests asynchronously and keeps cached state
 */
export default class StationManager {

  /**
   * Create a Station Manager
   *
   * @param {Object} nconf - Instance of nconf configuration
   * @param {Object} logger - Instance of winston logger
   * @param {HilbertCLIConnector} hilbertCLI - hilbert-cli connector
   * @param {MKLivestatusConnector} mkLivestatus - MKLivestatus connector
   */
  constructor(nconf, logger, hilbertCLI, mkLivestatus) {
    this.nconf = nconf;
    this.logger = logger;

    this.hilbertCLI = hilbertCLI;
    this.mkLivestatus = mkLivestatus;

    this.events = new EventEmitter();
    this.logEntries = [];
    this.lastLogID = 1;

    this.globalHilbertCLIOutputBuffer = new TerminalOutputBuffer();
    this.lastMKLivestatusDump = [];

    this.clearStations();
  }

  /**
   * Reads the station configuration and begins polling station status
   *
   * @return {Promise}
   */
  init() {
    return this.loadStationConfig().then(() => {
      const pollLoopBody = () => {
        const pollDelay = this.nconf.get('mkls_poll_delay');
        let consecutiveErrors = 0;
        const errorDigestSize = 50;
        this.pollMKLivestatus().then(() => {
          consecutiveErrors = 0;
          setTimeout(pollLoopBody, pollDelay);
        }).catch(() => {
          if (consecutiveErrors % errorDigestSize) {
            if (consecutiveErrors !== 0) {
              this.logger.error(
                `Station manager: Repeated MKLivestatus polling errors (${errorDigestSize} times)`);
            }
          }
          consecutiveErrors++;
          setTimeout(pollLoopBody, pollDelay);
        });
      };
      pollLoopBody();
    });
  }

  /**
   * Loads the station configuration.
   *
   * If the configuration was already loaded this method clears it
   * and reloads everything
   *
   * @returns {Promise}
   */
  loadStationConfig() {
    this.clearStations();
    this.signalUpdate();

    return this.hilbertCLI.getStationConfig(
      this.globalHilbertCLIOutputBuffer).then((stationsCFG) => {
        for (const stationCFG of stationsCFG) {
          this.addStation(new Station(stationCFG));
        }
        this.signalUpdate();
      });
  }

  /**
   * Adds a station to the manager
   * @param {Station} aStation
   */
  addStation(aStation) {
    this.logger.verbose(`Station manager: Adding station ${aStation.id}`);
    this.stationList.push(aStation);
    this.stationIndex.set(aStation.id, aStation);
  }

  /**
   * Removes a station from the manager
   * @param {Station} aStation
   */
  removeStation(aStation) {
    this.logger.verbose(`Station manager: Removing station ${aStation.id}`);
    const i = this.stationList.indexOf(aStation);
    if (i !== -1) {
      this.stationList.splice(i, 1);
    }

    this.stationIndex.delete(aStation.id);
  }

  /**
   * Removes all the stations
   */
  clearStations() {
    this.logger.verbose('Station manager: Clearing all stations');
    this.stationIndex = new Map();
    this.stationList = [];
  }

  /**
   * Get the ordered list of stations
   * @returns {Array}
   */
  getStations() {
    return this.stationList;
  }

  /**
   * Return a station identified by ID
   *
   * @param {string} id - Station ID
   * @returns {Station}
   */
  getStationByID(id) {
    return this.stationIndex.get(id);
  }

  /**
   * Start indicated stations
   *
   * @param {Iterable} stationIDs - IDs of stations to start
   * @return {Promise}
   */
  startStations(stationIDs) {
    const eligibleStations = [];
    for (const stationID of stationIDs) {
      const station = this.getStationByID(stationID);
      if (station && station.setQueuedToStartState()) {
        eligibleStations.push(stationID);
      }
    }

    this.signalUpdate();

    return Promise.map(
      eligibleStations,
      (eligibleStation) => {
        this.logger.verbose(`Station manager: Starting station ${eligibleStation}`);
        const station = this.getStationByID(eligibleStation);
        station.setStartingState();
        this.signalUpdate();
        return this.hilbertCLI.startStation(station.id, station.outputBuffer).then(() => {
          this.logger.verbose(`Station manager: Station ${eligibleStation} started`);
          this.log('message', station, 'Station started');
        })
        .catch(() => {
          this.logger.verbose(`Station manager: Station ${eligibleStation} failed to start`);
          this.log('error', station, 'Error starting station');
          station.setErrorState('Failure starting the station');
        })
        .then(() => {
          this.signalUpdate();
        });
      },
      { concurrency: this.nconf.get('scriptConcurrency') }
    );
  }

  /**
   * Stop indicated stations
   *
   * @param {Iterable} stationIDs - IDs of stations to stop
   * @return {Promise}
   */
  stopStations(stationIDs) {
    const eligibleStations = [];
    for (const stationID of stationIDs) {
      const station = this.getStationByID(stationID);
      if (station && station.setQueuedToStopState()) {
        eligibleStations.push(stationID);
      }
    }

    this.signalUpdate();

    return Promise.map(
      eligibleStations,
      (eligibleStation) => {
        this.logger.verbose(`Station manager: Stopping station ${eligibleStation}`);
        const station = this.getStationByID(eligibleStation);
        station.setStoppingState();
        this.signalUpdate();
        return this.hilbertCLI.stopStation(station.id, station.outputBuffer).then(() => {
          this.logger.verbose(`Station manager: Station ${eligibleStation} stopped`);
          this.log('message', station, 'Station stopped');
        })
          .catch(() => {
            this.logger.verbose(`Station manager: Station ${eligibleStation} failed to stop`);
            this.log('error', station, 'Error stopping station');
            station.setErrorState('Failure stopping the station');
          })
          .then(() => {
            this.signalUpdate();
          });
      },
      { concurrency: this.nconf.get('scriptConcurrency') }
    );
  }

  /**
   * Change the application running in indicated stations
   *
   * @param {Iterable} stationIDs - IDs of stations in which to change the appID
   * @param {string} appID - Name of the appID to run
   * @return {Promise}
   */
  changeApp(stationIDs, appID) {
    const eligibleStations = [];
    for (const stationID of stationIDs) {
      const station = this.getStationByID(stationID);
      if (station && station.setQueuedToChangeAppState(appID)) {
        eligibleStations.push(stationID);
      }
    }

    this.signalUpdate();

    return Promise.map(
      eligibleStations,
      (eligibleStation) => {
        this.logger.verbose(
          `Station manager: Changing app of station ${eligibleStation} to ${appID}`);
        const station = this.getStationByID(eligibleStation);
        station.setChangingAppState(appID);
        this.signalUpdate();
        return this.hilbertCLI.changeApp(eligibleStation, appID, station.outputBuffer).then(() => {
          this.logger.verbose(
            `Station manager: Changed app of station ${eligibleStation} to ${appID}`);
          this.log('message', station, `Launched app ${appID}`);
        })
        .catch(() => {
          this.logger.verbose(
            `Station manager: Failed changing app of station ${eligibleStation} to ${appID}`);
          this.log('error', station, `Failed to launch app ${appID}`);
          station.setErrorState(`Failed to open ${appID}`);
        })
        .then(() => {
          this.signalUpdate();
        });
      },
      { concurrency: this.nconf.get('scriptConcurrency') }
    );
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
   * @returns {Array}
   */
  getLog() {
    return this.logEntries;
  }


  /**
   * Logs an event
   *
   * @param {string} type - Event type: info | warning | error
   * @param {Station|null} station - station associated with the event logged
   * @param {string} message - Message to log
   */
  log(type, station, message) {
    const newLogEntry = {
      id: this.lastLogID,
      time: new Date().toISOString(),
      type,
      message,
    };

    if (station !== null) {
      newLogEntry.station_id = station.id;
      newLogEntry.station_name = station.name;
    }

    this.lastLogID++;
    this.logEntries.push(newLogEntry);

    const maxEntries = this.nconf.get('max_log_length');
    if (this.logEntries.length > maxEntries) {
      this.logEntries = this.logEntries.slice(this.logEntries.length - maxEntries);
    }
  }

  /**
   * Polls MKLivestatus and updates the state of stations
   * @returns {Promise}
   */
  pollMKLivestatus() {
    return this.mkLivestatus.getState().then((allStationsStatus) => {
      const lastState = [];
      let changes = false;
      for (const stationStatus of allStationsStatus) {
        lastState.push(stationStatus);
        const station = this.getStationByID(stationStatus.id);
        if (station) {
          if (station.updateFromMKLivestatus(stationStatus)) {
            changes = true;
          }
        }
      }
      this.lastMKLivestatusDump = lastState;

      if (changes) {
        this.signalUpdate();
      }
    });
  }
  /**
   * Signal listeners that station data was modified
   * @private
   */
  signalUpdate() {
    this.events.emit('stationUpdate');
  }
}
