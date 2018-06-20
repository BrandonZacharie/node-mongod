# mongod

This project adheres to [Semantic Versioning](http://semver.org/). Notable
changes to this project will be documented in this file for which the format
is based on [Keep a Changelog](http://keepachangelog.com/).

### [Unreleased][]

#### Changed

- Replace `istanbul` with `nyc` for testing
- Update dependencies
  - promise-queue 2.2.5
- Update dev dependencies
  - chai 4.1.2
  - coveralls 3.0.1
  - eslint 4.19.1
  - fs-promise 2.0.3
  - js-yaml 3.12.0
  - mocha 5.2.0
  - remark-cli 5.0.0
  - remark-preset-lint-recommended 3.0.2
  - uuid 3.2.1

#### Deprecated

- Support for Node.js versions not designated as LTS

### [2.0.0][] - 2017-01-17

#### Added

- Support for NPM install
- Lint markdown with remark

### [1.0.0][] — 2017-01-16

#### Added

- Changelog

#### Fixed

- “stdout” event not emitted for stderr

---

### [0.2.0][] — 2017-01-08

#### Added

- Support for `--nojournal` (`Mongod~Config#nojournal`)

---

### [0.1.0][] — 2017-01-08

#### Added

- Support for `--storageEngine` (`Mongod~Config#storageEngine`)
- “open” and “close” events

#### Changed

- Update dev dependencies
  - eslint 3.13.0

#### Fixed

- Errors when calling `#open()` or `#close()` repetitiously

---

### [0.0.1][] — 2016-12-24

#### Added

- Initial release

[Unreleased]: https://github.com/BrandonZacharie/node-mongod/compare/2.0.0...HEAD
[2.0.0]: https://github.com/BrandonZacharie/node-mongod/compare/1.0.0...2.0.0
[1.0.0]: https://github.com/BrandonZacharie/node-mongod/compare/0.2.0...1.0.0
[0.2.0]: https://github.com/BrandonZacharie/node-mongod/compare/0.1.0...0.2.0
[0.1.0]: https://github.com/BrandonZacharie/node-mongod/compare/0.0.1...0.1.0 
[0.0.1]: https://github.com/BrandonZacharie/node-mongod/compare/694e8...0.0.1
