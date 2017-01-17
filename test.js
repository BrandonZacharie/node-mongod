'use strict';

const childprocess = require('child_process');
const chai = require('chai');
const fspromise = require('fs-promise');
const jsyaml = require('js-yaml');
const mocha = require('mocha');
const uuid = require('uuid');
const Mongod = require('./Mongod');
const expect = chai.expect;
const after = mocha.after;
const before = mocha.before;
const describe = mocha.describe;
const it = mocha.it;

/**
 * Get a random port number.
 * @return {Number}
 */
const generateRandomPort = () =>
  Math.floor(Math.random() * 10000) + 9000;

/**
 * Get a random data path.
 * @return {Number}
 */
const generateRandomPath = () =>
  `data/db/${uuid.v4()}`;

/**
 * Get a {@link Promise} that is resolved or rejected when the given
 * {@linkcode delegate} invokes the callback it is provided.
 * @argument {Function} delegate
 * @return {Promise}
 */
const promisify = (delegate) =>
  new Promise((resolve, reject) => {
    delegate((err, value) => {
      if (err == null) {
        resolve(value);
      }
      else {
        reject(err);
      }
    });
  });

/**
 * Make a directory at a givem {@linkcode dir} path.
 * @argument {String} dir
 * @return {Promise}
 */
const mkdir = (dir) =>
  fspromise.mkdirs(dir);

/**
 * Make the dbpath directory for a given {@linkcode server}.
 * @argument {Mongod} server
 * @return {Promise}
 */
const mkdbpath = (server) =>
  mkdir(server.config.dbpath);

/**
 * Expect a given {@linkcode server} to not be opening, closing, or running.
 * @argument {Mongod} server
 * @return {undefined}
 */
const expectIdle = (server) => {
  expect(server.isOpening).to.equal(false);
  expect(server.isRunning).to.equal(false);
  expect(server.isClosing).to.equal(false);
};

/**
 * Expect a given {@linkcode server} to be running.
 * @argument {Mongod} server
 * @return {undefined}
 */
const expectRunning = (server) => {
  expect(server.isOpening).to.equal(false);
  expect(server.isRunning).to.equal(true);
  expect(server.isClosing).to.equal(false);
  expect(server.process).to.not.equal(null);
};

/**
 * Attempt to start a given {@linkcode server} and expect it to be opening.
 * Passes {linkcode done} to {@link Mongod#open}.
 * @argument {Mongod} server
 * @argument {Mongod~callback} [done]
 * @return {undefined}
 */
const expectToOpen = (server, done) => {
  const oldPromise = server.openPromise;
  const newPromise = server.open(done);

  expect(newPromise).to.be.a('promise');
  expect(newPromise).to.not.equal(oldPromise);
  expect(server.isOpening).to.equal(true);

  return newPromise;
};

/**
 * Attempt to stop a given {@linkcode server} and expect it be closing.
 * Passes {linkcode done} to {@link Mongod#close}.
 * @argument {Mongod} server
 * @argument {Mongod~callback} [done]
 * @return {undefined}
 */
const expectToClose = (server, done) => {
  const oldPromise = server.openPromise;
  const newPromise = server.close(done);

  expect(newPromise).to.be.a('promise');
  expect(newPromise).to.not.equal(oldPromise);
  expect(server.isClosing).to.equal(true);

  return newPromise;
};

/**
 * Parse the port number from the stdout of a given {@linkcode server}.
 * @argument {Mongod} server
 * @argument {Function} callback
 * @return {undefined}
 */
const parsePort = (server, callback) => {
  const portRegExp = /port=(\d+)/ig;

  /**
   * A listener for stdout of the current server. Invokes {@linkcode callback}
   * with the first parsed {@linkcode portRegExp} match.
   * @argument {String} value
   * @return {undefined}
   */
  const listener = (value) => {
    const matches = portRegExp.exec(value);

    if (matches !== null) {
      server.removeListener('stdout', listener);

      return callback(Number(matches.pop()));
    }
  };

  server.on('stdout', listener);
};

describe('Mongod', () => {
  let bin = null;
  const conf = `${new Date().toISOString()}.conf`;
  const port = generateRandomPort();
  const dbpath = generateRandomPath();
  const storageEngine = 'inMemory';
  const nojournal = true;

  before((done) => {
    childprocess.exec('pkill mongod', () => {
      done();
    });
  });
  before((done) => {
    childprocess.exec('which mongod', (err, stdout) => {
      bin = stdout.trim();

      done(err);
    });
  });
  before(() => fspromise.emptyDir('data/db'));
  before(() => {
    const yaml = jsyaml.dump({
      net: {
        bindIp: '127.0.0.1',
        port
      },
      storage: {
        dbPath: dbpath,
        journal: {
          enabled: false
        }
      }
    });

    return fspromise.writeFile(conf, yaml);
  });
  before(() => mkdir(dbpath));
  after(() => fspromise.unlink(conf));
  describe('.parseConfig()', () => {
    it('should parse bin, port, and dbpath', () => {
      const expectedObject = { bin, port, dbpath };
      const expectedKeys = Object.keys(expectedObject).sort();

      expectedObject.foo = 'bar';

      const actualObject = Mongod.parseConfig(expectedObject);
      const actualKeys = Object.keys(actualObject).sort();

      for (let key of expectedKeys) {
        expect(actualObject).to.have.property(key).equal(expectedObject[key]);
      }

      expect(actualKeys).to.eql(expectedKeys);
    });
    it('should parse bin and conf only', () => {
      const expectedObject = { bin, conf, port, dbpath };
      const actualObject = Mongod.parseConfig(expectedObject);

      expect(actualObject).to.have.property('bin').equal(expectedObject.bin);
      expect(actualObject).to.have.property('conf').equal(expectedObject.conf);
      expect(Object.keys(actualObject)).to.have.length(2);
    });
    it('should work without arguments', () => {
      expect(Mongod.parseConfig()).to.be.an('object');
      expect(Mongod.parseConfig(false)).to.be.an('object');
      expect(Mongod.parseConfig(null)).to.be.an('object');
      expect(Mongod.parseConfig({ port: null })).to.be.an('object');
    });
    it('accepts a port as a string', () => {
      const port = '1234';
      const config = Mongod.parseConfig(port);

      expect(config.port).to.equal(port);
    });
    it('accepts a port as a number', () => {
      const port = 1234;
      const config = Mongod.parseConfig(port);

      expect(config.port).to.equal(port);
    });
    it('accepts a configuration object', () => {
      const expectedObject = { bin, port, dbpath, storageEngine, nojournal };
      const actualObject = Mongod.parseConfig(expectedObject);

      expect(actualObject).to.eql(expectedObject);
    });
  });
  describe('.parseFlags()', () => {
    it('should return an empty array when given an empty object', () => {
      expect(Mongod.parseFlags({})).to.have.length(0);
    });
    it('should return port, dbpath, and storageEngine', () => {
      const config = { bin, port, dbpath, storageEngine, nojournal };
      const actualFlags = Mongod.parseFlags(config);
      const expectedFlags = [
        '--nojournal',
        '--storageEngine',
        config.storageEngine,
        '--dbpath',
        config.dbpath,
        '--port',
        config.port
      ];

      expect(actualFlags).to.eql(expectedFlags);
    });
    it('should return conf', () => {
      const config = { bin, conf, port, dbpath, storageEngine };

      expect(Mongod.parseFlags(config)).to.eql(['--config', config.conf]);
    });
  });
  describe('.parseData()', () => {
    it('parses a "waiting for connections" message', () => {
      const string = '2017-01-08T15:31:53.598-0800 I NETWORK  [thread1] waiting\
      for connections on port 27017';
      const result = Mongod.parseData(string);

      expect(result).to.be.an('object').and.have.property('err');
      expect(result.err).to.equal(null);
    });
    it('parses a "Address already in use" error', () => {
      const string = '2017-01-08T15:46:59.256-0800 E NETWORK  [initandlisten]\
      listen(): bind() failed Address already in use for socket: 0.0.0.0:27017';
      const result = Mongod.parseData(string);

      expect(result).to.be.an('object').and.have.property('err');
      expect(result.err).to.be.an('error').with.property('code').equal(-1);
    });
    it('parses a "Permission denied" error', () => {
      const string = '2017-01-08T15:38:00.708-0800 E NETWORK  [initandlisten]\
      listen(): bind() failed Permission denied for socket: 0.0.0.0:1';
      const result = Mongod.parseData(string);

      expect(result).to.be.an('object').and.have.property('err');
      expect(result.err).to.be.an('error').with.property('code').equal(-2);
    });
    it('parses a "parsing" error', () => {
      const string = 'Error parsing option "port" as int: Bad digit "f" while\
      parsing fubar\ntry \'mongod --help\' for more information';

      expect(Mongod.parseData(string))
      .to.have.property('err').be.an('error').with.property('code').equal(-3);
    });
    it('parses a "exception" error', () => {
      const string = '2017-01-08T15:42:56.097-0800 I STORAGE  [initandlisten]\
      exception in initAndListen: 18656 Cannot start server with an unknown\
      storage engine: WiredTiger, terminating';
      const result = Mongod.parseData(string);

      expect(result).to.be.an('object').and.have.property('err');
      expect(result.err).to.be.an('error').with.property('code').equal(-3);
    });
    it('returns `null` when given an unrecognized value', () => {
      const values = ['invalid', '', null, undefined, {}, 1234];

      for (let value of values) {
        expect(Mongod.parseData(value)).to.equal(null);
      }
    });
  });
  describe('#constructor()', () => {
    it('constructs a new instance', () => {
      const server = new Mongod();

      expectIdle(server);
      expect(server.process).to.equal(null);
    });
    it('throws when invoked without the `new` keyword', () => {
      expect(Mongod).to.throw();
    });
    it('calls .parseConfig', () => {
      const parseConfig = Mongod.parseConfig;
      let expectedObject = { port };
      let actualObject = null;

      Mongod.parseConfig = (source, target) => {
        actualObject = source;

        return parseConfig(source, target);
      };

      const server = new Mongod(expectedObject);

      Mongod.parseConfig = parseConfig;

      expect(actualObject).to.equal(expectedObject);
      expect(server.config.port).to.equal(expectedObject.port);
    });
  });
  describe('#open()', () => {
    it('should start a server and execute a callback', () => {
      const server = new Mongod({
        nojournal,
        dbpath,
        port: generateRandomPort()
      });

      return expectToOpen(server, (err, res) => {
        expect(err).to.equal(null);
        expect(res).to.equal(null);
        expectRunning(server);

        return server.close();
      });
    });
    it('should pass proper arguments to a callback on failure', () => {
      const server = new Mongod({ port: 'badport' });

      return server.open((err, res) => {
        expect(err).to.be.an('error');
        expect(res).to.equal(null);
      });
    });
    it('should start a server and resolve a promise', () => {
      const server = new Mongod({
        nojournal,
        dbpath,
        port: generateRandomPort()
      });

      return expectToOpen(server).then((res) => {
        expectRunning(server);
        expect(res).to.equal(null);

        return server.close();
      });
    });
    it('should do nothing when a server is already starting', () => {
      const server = new Mongod({
        nojournal,
        dbpath,
        port: generateRandomPort()
      });
      let openingCount = 0;
      let openCount = 0;

      server.on('opening', () => ++openingCount);
      server.on('open', () => ++openCount);

      const expectedPromise = server.open();
      const actualPromise = server.open();

      return Promise.all([
        expectedPromise,
        actualPromise
      ])
      .then(() => {
        expect(actualPromise).to.equal(expectedPromise);
        expect(openingCount).to.equal(1);
        expect(openCount).to.equal(1);

        return server.close();
      });
    });
    it('should do nothing when a server is already started', () => {
      const server = new Mongod({
        nojournal,
        dbpath,
        port: generateRandomPort()
      });
      let openingCount = 0;
      let openCount = 0;

      server.on('opening', () => ++openingCount);
      server.on('open', () => ++openCount);

      return server.open()
      .then(() => server.open())
      .then(() => {
        expectRunning(server);
        expect(openingCount).to.equal(1);
        expect(openCount).to.equal(1);

        return server.close();
      });
    });
    it('should fail to start a server with a bad dbpath', () => {
      const server = new Mongod({ nojournal, dbpath: 'fubar', port });

      return server.open((err) => {
        expect(err).to.be.an('error').and.have.property('code').equal(-3);
      });
    });
    it('should fail to start a server with a bad port', () => {
      const server = new Mongod({ nojournal, dbpath, port: 'fubar' });

      return server.open((err) => {
        expect(err).to.be.an('error').and.have.property('code').equal(-3);
      });
    });
    it('should fail to start a server with a privileged port', () => {
      const server = new Mongod({ nojournal, dbpath, port: 1 });

      return server.open((err) => {
        expect(err).to.be.an('error').and.have.property('code').equal(-2);
      });
    });
    it('should fail to start a server on an in-use port', () => {
      const port = generateRandomPort();
      const server1 = new Mongod({
        nojournal,
        dbpath: generateRandomPath(),
        port
      });
      const server2 = new Mongod({
        nojournal,
        dbpath: generateRandomPath(),
        port
      });

      return Promise.all([
        mkdbpath(server1),
        mkdbpath(server2)
      ])
      .then(() => server1.open())
      .then(() => server2.open((err) => {
        expect(err).to.be.an('error').and.have.property('code').equal(-1);

        return server1.close();
      }));
    });
    it('should start a server with a given port', () => {
      const server = new Mongod({
        nojournal,
        dbpath,
        port: generateRandomPort()
      });
      let actualPort = null;

      parsePort(server, (port) => actualPort = port);

      return expectToOpen(server).then(() => {
        expect(actualPort).to.equal(server.config.port);

        return server.close();
      });
    });
    it('should start a server with a given MongoDB conf', () => {
      const server = new Mongod({ conf });
      let actualPort = null;

      parsePort(server, (port) => actualPort = port);

      return expectToOpen(server).then(() => {
        expect(actualPort).to.equal(port);

        return server.close();
      });
    });
    it('should start a server with a given MongoDB binary', () => {
      const server = new Mongod({ nojournal, dbpath, bin, port });

      return expectToOpen(server).then(() => server.close());
    });
    it('should start a server after #close() finishes', () => {
      const server = new Mongod({
        nojournal,
        dbpath,
        port: generateRandomPort()
      });

      return Promise.all([
        server.open(),
        promisify((done) => setTimeout(() => server.close(done), 10)),
        promisify((done) => setTimeout(() => server.open(done), 15)),
        promisify((done) => setTimeout(() => server.close(done), 20)),
        promisify((done) => setTimeout(() => server.open(done), 25))
      ])
      .then(() => {
        expectRunning(server);

        return server.close();
      });
    });
    it('should start a server while others run on different ports', () => {
      const server1 = new Mongod({
        nojournal,
        dbpath: generateRandomPath(),
        port: generateRandomPort()
      });
      const server2 = new Mongod({
        nojournal,
        dbpath: generateRandomPath(),
        port: generateRandomPort()
      });
      const server3 = new Mongod({
        nojournal,
        dbpath: generateRandomPath(),
        port: generateRandomPort()
      });

      return Promise.all([
        mkdbpath(server1),
        mkdbpath(server2),
        mkdbpath(server3)
      ])
      .then(() => Promise.all([
        server1.open(),
        server2.open(),
        server3.open()
      ]))
      .then(() => {
        expectRunning(server1);
        expectRunning(server2);
        expectRunning(server3);

        return Promise.all([
          server1.close(),
          server2.close(),
          server3.close()
        ]);
      });
    });
    it('emits "opening" and "open" when starting a server', () => {
      const server = new Mongod({
        nojournal,
        dbpath,
        port: generateRandomPort()
      });
      let openingCount = 0;
      let openCount = 0;

      server.on('opening', () => ++openingCount);
      server.on('open', () => ++openCount);

      return server.open()
      .then(() => server.close())
      .then(() => server.open())
      .then(() => server.open())
      .then(() => server.close())
      .then(() => {
        expect(openingCount).to.equal(2);
        expect(openCount).to.equal(2);
      });
    });
    it('emits "closing" and "close" when failing to start a server', () => {
      const server = new Mongod({ nojournal, dbpath, port: 'fubar' });
      let closingCount = 0;
      let closeCount = 0;

      server.on('closing', () => ++closingCount);
      server.on('close', () => ++closeCount);

      return server.open((err) => {
        expect(err).to.be.an('error').and.have.property('code').equal(-3);
      })
      .then(() => {
        return server.open((err) => {
          expect(err).to.be.an('error').and.have.property('code').equal(-3);
        });
      })
      .then(() => {
        expect(closingCount).to.equal(2);
        expect(closeCount).to.equal(2);

        return server.close();
      });
    });
  });
  describe('#close()', () => {
    it('should close a server and execute a callback', () => {
      const server = new Mongod({
        nojournal,
        dbpath,
        port: generateRandomPort()
      });

      return server.open()
      .then(() => promisify((done) => expectToClose(server, done)));
    });
    it('should close a server and resolve a promise', () => {
      const server = new Mongod({
        nojournal,
        dbpath,
        port: generateRandomPort()
      });

      return server.open().then(() => expectToClose(server));
    });
    it('should report any error when applicable', () => {
      const server = new Mongod({
        nojournal,
        dbpath,
        port: generateRandomPort()
      });
      const close = Mongod.close;

      Mongod.close = () =>
        Promise.reject(new Error());

      return server.open(() => {
        return server.close((err, res) => {
          Mongod.close = close;

          expect(err).to.be.an('error');
          expect(res).to.equal(null);

          return server.close();
        });
      });
    });
    it('should do nothing when a server is already stopping', () => {
      const server = new Mongod({
        nojournal,
        dbpath,
        port: generateRandomPort()
      });

      return server.open().then(() => {
        expect(server.close()).to.equal(server.close());

        return server.close();
      });
    });
    it('should do nothing when a server is already stopped', () => {
      const server = new Mongod({
        nojournal,
        dbpath,
        port: generateRandomPort()
      });

      return server.open()
      .then(() => server.close())
      .then(() => {
        server.close();
        expect(server.isClosing).to.equal(false);
        expectIdle(server);
      });
    });
    it('should do nothing when a server was never started', () => {
      const server = new Mongod();

      server.close();
      expect(server.isClosing).to.equal(false);
      expectIdle(server);
    });
    it('should stop a server after #open() finishes', () => {
      const server = new Mongod({
        nojournal,
        dbpath,
        port: generateRandomPort()
      });

      return Promise.all([
        server.open(),
        promisify((done) => setTimeout(() => server.close(done), 10)),
        promisify((done) => setTimeout(() => server.open(done), 15)),
        promisify((done) => setTimeout(() => server.close(done), 20))
      ])
      .then(() => {
        expectIdle(server);
      });
    });
    it('emits "closing" and "close" when stopping a server', () => {
      const server = new Mongod({
        nojournal,
        dbpath,
        port: generateRandomPort()
      });
      let closingCount = 0;
      let closeCount = 0;

      server.on('closing', () => ++closingCount);
      server.on('close', () => ++closeCount);

      return server.open()
      .then(() => server.close())
      .then(() => server.open())
      .then(() => server.close())
      .then(() => server.close())
      .then(() => {
        expect(closingCount).to.equal(2);
        expect(closeCount).to.equal(2);
      });
    });
  });
  describe('#isOpening', () => {
    it('is `true` while a server is starting', () => {
      const server = new Mongod({
        nojournal,
        dbpath,
        port: generateRandomPort()
      });

      expect(server.isOpening).to.equal(false);
      server.open();
      expect(server.isOpening).to.equal(true);

      return server.open()
      .then(() => {
        expect(server.isOpening).to.equal(false);
        server.close();
        expect(server.isOpening).to.equal(false);

        return server.close();
      })
      .then(() => {
        expect(server.isOpening).to.equal(false);
      });
    });
    it('is `true` while a misconfigured server is starting', () => {
      const server = new Mongod({ nojournal, dbpath, port: 'badport' });

      expect(server.isOpening).to.equal(false);
      server.open();
      expect(server.isOpening).to.equal(true);

      return server.open((err) => {
        expect(err).to.be.an('error').and.have.property('code').equal(-3);
        expect(server.isOpening).to.equal(false);
        server.close();
        expect(server.isOpening).to.equal(false);

        return server.close();
      })
      .then(() => {
        expect(server.isOpening).to.equal(false);
      });
    });
  });
  describe('#isClosing', () => {
    it('is `true` while a server is stopping', () => {
      const server = new Mongod({
        nojournal,
        dbpath,
        port: generateRandomPort()
      });

      expect(server.isClosing).to.equal(false);
      server.open();
      expect(server.isClosing).to.equal(false);

      return server.open()
      .then(() => {
        expect(server.isClosing).to.equal(false);
        server.close();
        expect(server.isClosing).to.equal(true);

        return server.close();
      })
      .then(() => {
        expect(server.isClosing).to.equal(false);
      });
    });
    it('is `true` when a server fails to start', () => {
      const server = new Mongod({ nojournal, dbpath, port: 'badport' });
      let isClosing = false;

      server.on('closing', () => isClosing = server.isClosing);
      expect(server.isClosing).to.equal(false);
      server.open();
      expect(server.isClosing).to.equal(false);

      return server.open((err) => {
        expect(err).to.be.an('error').and.have.property('code').equal(-3);
        expect(server.isClosing).to.equal(false);
        expect(isClosing).to.equal(true);
        server.close();
        expect(server.isClosing).to.equal(false);

        return server.close();
      })
      .then(() => {
        expect(server.isClosing).to.equal(false);
      });
    });
  });
  describe('#isRunning', () => {
    it('is `true` while a server accepts connections', () => {
      const server = new Mongod({
        nojournal,
        dbpath,
        port: generateRandomPort()
      });

      expect(server.isRunning).to.equal(false);
      server.open();
      expect(server.isRunning).to.equal(false);

      return server.open()
      .then(() => {
        expect(server.isRunning).to.equal(true);
        server.close();
        expect(server.isRunning).to.equal(true);

        return server.close();
      })
      .then(() => {
        expect(server.isRunning).to.equal(false);
      });
    });
    it('is `false` after a misconfigured server starts', () => {
      const server = new Mongod({ nojournal, dbpath, port: 'badport' });

      expect(server.isRunning).to.equal(false);
      server.open();
      expect(server.isRunning).to.equal(false);

      return server.open((err) => {
        expect(err).to.be.an('error').and.have.property('code').equal(-3);
        expect(server.isRunning).to.equal(false);
        server.close();
        expect(server.isRunning).to.equal(false);

        return server.close();
      })
      .then(() => {
        expect(server.isRunning).to.equal(false);
      });
    });
  });
});
