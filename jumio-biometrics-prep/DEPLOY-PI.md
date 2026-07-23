# Deploy Jumio Biometrics Prep on the Raspberry Pi

The built site is served from:

- directory: `/home/ajmalrasi/ml-interview-prep/jumio-biometrics-prep`
- service: `jumio-biometrics-prep.service`
- port: `9005`
- URL: `http://192.168.3.20:9005/`

Build locally with `node build.js`. The systemd service runs the repository-level
`prep_server.py`, which serves static files and stores this track's study progress in
`/home/ajmalrasi/ml-interview-prep/.progress/jumio-biometrics-prep.json`.

The service unit is kept in this folder as `jumio-biometrics-prep.service`; install it
under `/etc/systemd/system/`, reload systemd, enable and start it.
