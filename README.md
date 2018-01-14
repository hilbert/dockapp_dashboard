# hilbert-ui

A web interface to monitor, control and manage Dockapp. It includes a stand-alone web server 
that hosts a web service and a front end based on [React](https://facebook.github.io/react/). 

The parts of the ui are:

- Client
    - It's single page application based on the React framework.
    - Composed of static HTML, CSS, JS and image files.
    - It communicates with the server through AJAX queries.
    - ECMAScript 2015 is used and transpiled with babel.
    - Should be hosted with nginx.
- Server
    - Daemon that tracks the state of stations and operations
      performed on them.
    - Provides a web service interface (HTTP queries and JSON responses)
    - Programmed on node.js
    - ECMAScript 2015 is used and transpiled with babel.
    - Should be reverse proxied with nginx.

## Installation

0. Install [nginx](https://nginx.org/), if not already present in the system

0. Install the server's dependencies

        cd server
        npm install --production

0. Install the web front end's dependencies

        cd client
        npm install --production

0. Configure nginx to serve the static files and proxy the web service
 
    For example, within the `http` section of `nginx.conf` configure the default `server` with a 
    configuration like this one:
 
        server {
               listen       8080;
               server_name  localhost;
        
               location / {
                   root   /usr/local/hilbert/client/public;
                   index index.html index.htm;
               }
        
               location /api/ {
                       proxy_pass http://127.0.0.1:3000/;
                       proxy_redirect default;
                       proxy_http_version 1.1;
                       proxy_set_header Upgrade $http_upgrade;
                       proxy_set_header Connection 'upgrade';
                       proxy_set_header Host $host;
                       proxy_cache_bypass $http_upgrade;
               }
        
               error_page   500 502 503 504  /50x.html;
               location = /50x.html {
                   root   html;
               }
        }

    * Be sure to change the `root` to the location of the `public` directory of the hilbert ui. 
    * `proxy_pass` should correspond to the port the web service is running in (configured in the
      following step)
      
0. Start the web service by running

        node server/app/main.js

## Configuration

The ui configuration file is `server/config.json`. It supports the following options:

- `port`: (default '3000') Port number the ui server will run in.
- `hilbert_cli_path`: Path to the **hilbert-cli** installation.
- `test`: (default: false) Set to `true` to run in test mode, which uses simulated stations.
- `scriptConcurrency`: (default: 20) Number of simultaneous child processes that will be run.
- `max_log_length`: (default: 100) Max number of log entries to send through the web service.
- `log_directory`: (default: './log') Directory where logs will be saved.
- `log_level`: (default: 'info') Log level. Set to one of `error`, `warn`, `info`, `verbose`, `debug` or `silly`.
- `mkls_poll_delay`: (default: 1000) Number of milliseconds to wait between polls to MKLivestatus.
- `mkls_cmd`: (default: 'nc localhost 6557') Command line used to connect to MKLivestatus.
- `db_path`: (default: '') Path to the sqlite database file for persistant storage of features such as presets. 

## Directory reference

- **client**: Client files
    - **src/**: Client sources (JSX / ECMAScript 2015)
    - **sass/**: SASS stylesheets, compiled through `gulp sass`
    - **public/**: Static web files for the client, including CSS, JS, images and 
          third party libraries
- **server/**: Server files
    - **app/**: Transcompiled JS files. These are generated by babel and shouldn't be edited directly.
    - **app/test**: Transcompiled test files. These are generated by babel and shouldn't be edited directly.
    - **log/**: Back end log files
    - **scripts/**: Auxiliary scripts to interact with hilbert-cli
    - **src/**: Server sources (ECMAScript 2015)
    - **src/test**: Test sources (ECMAScript 2015)
    - **data/**: Auxiliary data files
    - **config.json**: Back end configuration file

## Building

### UI Server

The server sources are compiled from ECMAScript 2015 to regular JS using Babel.

0. Install the dependencies

        cd server
        npm install

0. Compile

        gulp --gulpfile server/gulpfile.js compile

### UI client

The client sources are compiled from JSX / ECMAScript 2015 to regular JS using Babel. 
Dependencies (like React) are also compiled and packed to a vendors.js file. 

0. Install the dependencies

        cd client
        npm install 

0. Compile JS sources

        gulp --gulpfile client/gulpfile.js scripts:dev

0. Compile SASS stylesheets

        gulp --gulpfile client/gulpfile.js sass

## Deployment with Docker

The [Dockerfile](Dockerfile) can be used to build a self-contained Docker image for the ui. 
Install [Docker](https://www.docker.com/), then build the image from the top level directory:

    docker build -t hilbert-ui .

Spin up a Docker container with

    docker run -p 8080:8080 hilbert-ui

This exposes the container's port 8080 to the host's port 8080.

## Credits

Eric Londaits for [IMAGINARY](https://www.imaginary.org)

## Copyright and license

Code and documentation copyright 2016 IMAGINARY gGmbH 
Code and documentation released under the Apache [License](LICENSE.md).
See the [Notice](NOTICE.md) for license information of included 
dependencies.
