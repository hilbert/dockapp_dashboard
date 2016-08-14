const Promise = require('bluebird');
import { exec } from 'child_process';
import MKLivestatusQuery from './mk-livestatus-query';

/**
 * Connects to the MK Livestatus service and
 * retrieves status data
 *
 * http://mathias-kettner.com/checkmk_livestatus.html
 */
export default class MKLivestatusConnector {

  constructor(nconf, logger) {
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
  getState() {
    const state = new Map();
    return this.getStationState()
      .then((stations) => {
        for (const station of stations) {
          if (station.hasOwnProperty('id')) {
            state.set(station.id, station);
          }
        }
        return this.getForegroundApps();
      })
      .then((stations) => {
        for (const station of stations) {
          if (station.hasOwnProperty('id') &&
              state.has(station.id)) {
            const stationState = state.get(station.id);
            stationState.app_state = station.app_state;
            stationState.app_state_type = station.app_state_type;
            stationState.app_id = station.app_id;
          }
        }

        return state.values();
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
  getStationState() {
    return this.query()
      .get('hosts')
      .columns(['name', 'state', 'state_type'])
      .asColumns(['id', 'state', 'state_type'])
      .execute();
  }

  /**
   * Queries the foreground apps running in the stations
   * Returns an array of objects with shape
   * {id: 'station name', app_state: 0, app_state_type: 1, app_id: 'app name'}
   * @private
   *
   * @returns {Promise}
   */
  getForegroundApps() {
    return this.query()
      .get('services')
      .columns(['host_name', 'state', 'state_type', 'plugin_output'])
      .asColumns(['id', 'app_state', 'app_state_type', 'app_id'])
      .filter('description = dockapp_top1')
      .execute()
      .then((stations) => {
        for (const station of stations) {
          // todo: replace for better regexp / parsing
          const matches = station.app_id.match(/^[^:]+:\s*(.*)@\[.*\]$/);
          if (matches.hasOwnProperty('length') && matches.length > 1) {
            station.app_id = matches[1];
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
  query() {
    return new MKLivestatusQuery(this);
  }

  /**
   * Sends a query command to MKLivestatus
   *
   * @param {String} queryString
   * @returns {Promise}
   * @resolve {Array} Response rows
   * @reject {Error}
   */
  sendCommand(queryString) {
    return new Promise((resolve) => {
      const process = exec(this.nconf.get('mkls_cmd'));

      let stdoutBuf = '';

      process.stdout.on('data', (data) => {
        stdoutBuf += data;
      }).on('end', () => {
        resolve(stdoutBuf);
      });

      process.stderr.on('data', (data) => {
        console.error(data);
      });

      process.stdin.end(`${queryString}\n\n`);
    });
  }
}

// When executed directly it performs a query
if (require.main === module) {
  const mkLivestatusConnector = new MKLivestatusConnector();
  console.log('Querying');
  mkLivestatusConnector.getState().then((state) => {
    console.log(state);
  });
}
