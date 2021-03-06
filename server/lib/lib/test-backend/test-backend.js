const dateformat = require('dateformat');
const Nagios = require('../nagios');
const TestHilbertCLIConnector = require('./test-hilbert-cli-connector');
const TestMKLivestatusConnector = require('./test-mk-livestatus-connector');

class TestBackend {

  constructor(nconf, logger) {
    this.simulateDelays = false;
    this.nconf = nconf;
    this.logger = logger;

    this.hilbertCLIConnector = new TestHilbertCLIConnector(this, nconf, logger);
    this.mkLivestatusConnector = new TestMKLivestatusConnector(this, nconf, logger);

    this.hilbertCfg = null;

    this.state = new Map();
    this.station_cfg = new Map();
  }

  /**
   * Loads test data
   *
   * If any data was previously loaded it's overwritten.
   *
   * @param {Array} hilbertCfg An array of station configurations
   */
  load(hilbertCfg) {
    this.hilbertCfg = hilbertCfg;

    this.state = new Map();
    this.station_cfg = new Map();

    for (const [stationID, stationData] of Object.entries(hilbertCfg.Stations)) {
      this.addStation(stationID, stationData);
    }
  }

  /**
   * Adds a station
   *
   * @param id ID of the station
   * @param stationCfg Configuration of the station, taken from the configuration file
   */
  addStation(id, stationCfg) {
    this.station_cfg.set(id, {
      id,
      name: stationCfg.name,
      description: stationCfg.description,
      profile: stationCfg.profile,
      type: stationCfg.type,
      default_app: stationCfg.client_settings.hilbert_station_default_application,
      compatible_apps: stationCfg.compatible_applications,
    });

    this.initStationState(id);
  }

  /**
   * Initializes the state of a station to the default (station down, app down)
   *
   * @param {String} id Station ID
   */
  initStationState(id) {
    this.state.set(id, {
      id,
      state: Nagios.HostState.DOWN,
      state_type: Nagios.StateType.HARD,
      start_time: '',
      app_state: Nagios.ServiceState.UNKNOWN,
      app_state_type: Nagios.StateType.HARD,
      app_id: '',
      app_start_time: '',
    });
  }

  /**
   * Returns a HilbertCLIConnector stub for testing
   * @returns {TestHilbertCLIConnector}
   */
  getHilbertCLIConnector() {
    return this.hilbertCLIConnector;
  }

  /**
   * Returns a MKLivestatusConnector stub for testing
   * @returns {TestMKLivestatusConnector}
   */
  getMKLivestatusConnector() {
    return this.mkLivestatusConnector;
  }

  getStationState() {
    const answer = [];

    const toStopUnexpectedly = this.nconf.get('test-backend:stop-unexpectedly') || [];
    const unreachable = this.nconf.get('test-backend:unreachable') || [];
    for (const stationState of this.state.values()) {
      const newState = Object.assign({}, stationState);

      if (toStopUnexpectedly.includes(stationState.id)) {
        TestBackend.setStateDown(stationState);
        // This new state overrides the internal state
        this.state.set(stationState.id, newState);
      }
      if (unreachable.includes(stationState.id)) {
        newState.state = Nagios.HostState.UNREACHABLE;
        // This new state is does not override the internal state
      }

      answer.push(newState);
    }
    this.nconf.set('test-backend:stop-unexpectedly', []);

    return answer;
  }

  /**
   * Reads the station config
   * @returns {Promise}
   * @resolve {Array} - List of stations
   * @reject {Error}
   */
  getHilbertCfg(output) {
    return new Promise((resolve) => {
      output.write('Simulating reading hilbert configuration. Waiting a random delay...');
      this.randomDelay(1000, 3000).then(() => {
        output.write('Wait finished.');
        resolve(this.hilbertCfg);
      });
    });
  }

  /**
   * Starts a station
   *
   * @param stationID
   * @param {Writable} output - Command output should be written here
   * @returns {Promise}
   */
  startStation(stationID, output) {
    if (this.nconf.get('test-backend:sim-fail-cli') === true) {
      return Promise.reject(new Error('Simulated Hilbert CLI failure'));
    }

    return new Promise((resolve) => {
      if (this.nconf.get('test-backend:sim-timeout') === true) {
        output.write(`Simulating starting station ${stationID} with operation that times out.`);
      } else {
        output.write(`Simulating starting station ${stationID}. Waiting a random delay...`);
        this.randomDelay(2500, 5000).then(() => {
          output.write('Wait finished.');
          const stationState = this.state.get(stationID);
          if (stationState &&
            (stationState.state === Nagios.HostState.DOWN)) {
            TestBackend.setStateUp(stationState);
            return this.randomDelay(2500, 5000).then(() => {
              if (this.nconf.get('test-backend:sim-unexpected-off') === true) {
                TestBackend.setStateDown(stationState);
              } else {
                const stationCfg = this.station_cfg.get(stationID);
                TestBackend.setStateAppUp(stationState, stationCfg.default_app);
                output.write(`Station state set to UP with app ${stationState.app_id}.`);
              }
            });
          }
          return Promise.resolve();
        });
      }

      resolve();
    });
  }

  /**
   * Stops a station
   *
   * @param stationID
   * @param {Writable} output - Command output should be written here
   * @returns {Promise}
   */
  stopStation(stationID, output) {
    if (this.nconf.get('test-backend:sim-fail-cli') === true) {
      return Promise.reject(new Error('Simulated Hilbert CLI failure'));
    }

    return new Promise((resolve) => {
      if (this.nconf.get('test-backend:sim-timeout') === true) {
        output.write(`Simulating stopping station ${stationID} with operation that times out.`);
      } else {
        output.write(`Simulating stopping station ${stationID}. Waiting a random delay...`);
        this.randomDelay(2000, 6000).then(() => {
          output.write('Wait finished.');
          const stationState = this.state.get(stationID);
          if (stationState && (stationState.state === Nagios.HostState.UP)) {
            TestBackend.setStateDown(stationState);
            output.write('Station state set to DOWN.');
          }
        });
      }

      resolve();
    });
  }

  /**
   * Restarts a station
   *
   * @param stationID
   * @param {Writable} output - Command output should be written here
   * @returns {Promise}
   */
  restartStation(stationID, output) {
    if (this.nconf.get('test-backend:sim-fail-cli') === true) {
      return Promise.reject(new Error('Simulated Hilbert CLI failure'));
    }

    return new Promise((resolve) => {
      if (this.nconf.get('test-backend:sim-timeout') === true) {
        output.write(`Simulating restarting station ${stationID} with operation that times out.`);
      } else {
        output.write(`Simulating restarting station ${stationID}. Waiting a random delay...`);
        this.randomDelay(2000, 6000)
          .then(() => {
            output.write('Wait finished.');
            const stationState = this.state.get(stationID);
            if (stationState && (stationState.state === Nagios.HostState.UP)) {
              TestBackend.setStateDown(stationState);
              output.write('Station state set to DOWN.');
            }
            return this.randomDelay(2500, 5000);
          }).then(() => {
            const stationState = this.state.get(stationID);
            TestBackend.setStateUp(stationState);
            return this.randomDelay(2500, 5000);
          }).then(() => {
            const stationState = this.state.get(stationID);
            if (this.nconf.get('test-backend:sim-unexpected-off') === true) {
              TestBackend.setStateDown(stationState);
            } else {
              const stationCfg = this.station_cfg.get(stationID);
              TestBackend.setStateAppUp(stationState, stationCfg.default_app);
              output.write(`Station state set to UP with app ${stationState.app_id}.`);
            }
          });
      }

      resolve();
    });
  }

  /**
   * Restarts a station app
   *
   * @param stationID
   * @param {Writable} output - Command output should be written here
   * @returns {Promise}
   */
  restartStationApp(stationID, output) {
    const stationState = this.state.get(stationID);
    return this.changeApp(stationID, stationState.app_id, output);
  }

  /**
   * Change the foreground application running in a station
   *
   * @param {string} stationID - ID of the station
   * @param {string} appID - ID of the app to set
   * @param {Writable} output - Command output should be written here
   * @returns {Promise}
   */
  changeApp(stationID, appID, output) {
    if (this.nconf.get('test-backend:sim-fail-cli') === true) {
      return Promise.reject(new Error('Simulated Hilbert CLI failure'));
    }

    return new Promise((resolve, reject) => {
      if (this.nconf.get('test-backend:sim-timeout') === true) {
        output.write(`Simulating changing app for station ${stationID} to ${appID} with operation that times out.`);
      } else if (this.nconf.get('test-backend:sim-unexpected-off')) {
        const stationState = this.state.get(stationID);
        stationState.state = Nagios.HostState.DOWN;
        stationState.app_state = Nagios.ServiceState.UNKNOWN;
        stationState.app_id = '';
        stationState.app_start_time = '';
      } else {
        output.write(
          `Simulating changing app for station ${stationID} to ${appID}. Waiting a random delay...`);
        this.randomDelay(1000, 5000).then(() => {
          output.write('Wait finished.');
          const stationState = this.state.get(stationID);
          const stationCfg = this.station_cfg.get(stationID);
          if (stationCfg.compatible_apps.indexOf(appID) >= 0) {
            stationState.app_id = appID;
            stationState.app_start_time = TestBackend.appTimestamp();
            output.write('App changed.');
          }
        });
      }

      resolve();
    });
  }

  /**
   * Wait a random amount of time
   * @private
   * @param min
   * @param max
   * @returns {Promise}
   */
  randomDelay(min, max) {
    if (this.simulateDelays) {
      return new Promise((resolve) => {
        const delay = Math.floor(Math.random() * (max - min)) + min;
        setTimeout(() => {
          resolve();
        }, delay);
      });
    }

    return Promise.resolve();
  }

  static setStateUp(stationState) {
    stationState.state = Nagios.HostState.UP;
    stationState.start_time = TestBackend.stationTimestamp();
    stationState.app_state = Nagios.ServiceState.UNKNOWN;
    stationState.app_state_type = Nagios.StateType.HARD;
    stationState.app_id = '';
    stationState.app_start_time = '';
  }

  static setStateAppUp(stationState, appID) {
    stationState.app_state = Nagios.ServiceState.OK;
    stationState.app_state_type = Nagios.StateType.HARD;
    stationState.app_id = appID;
    stationState.app_start_time = TestBackend.appTimestamp();
  }

  static setStateDown(stationState) {
    stationState.state = Nagios.HostState.DOWN;
    stationState.start_time = '';
    stationState.app_state = Nagios.ServiceState.UNKNOWN;
    stationState.app_state_type = Nagios.StateType.HARD;
    stationState.app_id = '';
    stationState.app_start_time = '';
  }

  static stationTimestamp() {
    // Wed Jul  3 08:31:36 2019
    return dateformat(Date.now(), 'ddd mmm d hh:MM:ss yyyy');
  }

  static appTimestamp() {
    // 2019-07-03T06:32:14.671526364Z
    return dateformat(Date.now(), 'yyyy-mm-ddThh:MM:ss.lZ');
  }
}

module.exports = TestBackend;
