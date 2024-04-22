process.env.REQUEST_MAX_RETRY = 0;
const { Logger } = require('@elastic.io/component-commons-library');
const { expect } = require('chai');
const nock = require('nock');
const sinon = require('sinon');
const readCSV = require('../../lib/triggers/read.js');

const logger = Logger.getLogger();

describe('CSV Read component', async () => {
  let cfg;
  const msg = {};
  const context = {
    logger,
  };

  nock('http://test.env.mock')
    .get('/formats.csv')
    .times(10)
    .replyWithFile(200, `${__dirname}/../../test/formats.csv`);

  // Previously "Fetch All" was true and "Emit Individually" was false
  // The next two tests check that this backwards compatability is preserved.
  describe('Backwards compatibility check', async () => {
    it('Fetch All', async () => {
      cfg = {
        emitBehavior: 'fetchAll',
        url: 'http://test.env.mock/formats.csv',
        header: true,
        dynamicTyping: true,
        delimiter: '',
      };
      context.emit = sinon.spy();
      await readCSV.process.call(context, msg, cfg);

      expect(context.emit.callCount)
        .to.equal(1); // one emit call

      expect(context.emit.lastCall.firstArg)
        .to.equal('data'); // with data
    });

    it('emitBehavior: emitIndividually, header: false, dynamicTyping: false', async () => {
      cfg = {
        emitBehavior: 'emitIndividually',
        url: 'http://test.env.mock/formats.csv',
        header: false,
        dynamicTyping: false,
      };
      context.emit = sinon.spy();
      await readCSV.process.call(context, msg, cfg);

      expect(context.emit.callCount)
        .to.equal(3); // 3 emit calls

      expect(context.emit.getCall(1).args[1].body.column0)
        .to.equal('2.71828'); // result is number as string
    });
  });

  it('One file', async () => {
    cfg = {
      emitBehavior: 'fetchAll',
      url: 'http://test.env.mock/formats.csv',
      header: true,
      dynamicTyping: true,
      delimiter: '',
    };
    context.emit = sinon.spy();
    await readCSV.process.call(context, msg, cfg);

    expect(context.emit.callCount)
      .to.equal(1); // one emit call

    expect(context.emit.lastCall.firstArg)
      .to.equal('data'); // with data
  });

  it('emitBehavior: fetchAll, header: true, dynamicTyping: true', async () => {
    cfg = {
      emitBehavior: 'fetchAll',
      url: 'http://test.env.mock/formats.csv',
      header: true,
      dynamicTyping: true,
    };
    context.emit = sinon.spy();
    await readCSV.process.call(context, msg, cfg);

    expect(context.emit.callCount)
      .to.equal(1); // one emit call

    expect(context.emit.getCall(0).args[1].body.result.length)
      .to.equal(2); // result is array with 2 records

    expect(context.emit.getCall(0).args[1].body.result[0].Text)
      .to.equal('Lorem ipsum dolor sit amet'); // with text

    expect(context.emit.getCall(0).args[1].body.result[0].Number)
      .to.equal(2.71828); // Number
  });

  it('emitBehavior: emitBatch, header: true, dynamicTyping: true', async () => {
    cfg = {
      emitBehavior: 'emitBatch',
      url: 'http://test.env.mock/formats.csv',
      header: true,
      dynamicTyping: true,
      batchSize: '1',
    };
    context.emit = sinon.spy();
    await readCSV.process.call(context, msg, cfg);

    expect(context.emit.callCount)
      .to.equal(2); // one emit call

    expect(context.emit.getCall(0).args[1].body.result.length)
      .to.equal(1); // result is array with 2 records

    expect(context.emit.getCall(0).args[1].body.result[0].Text)
      .to.equal('Lorem ipsum dolor sit amet'); // with text

    expect(context.emit.getCall(0).args[1].body.result[0].Number)
      .to.equal(2.71828); // Number
  });

  it('emitBatch: true, batchSize is negative', async () => {
    cfg = {
      emitBehavior: 'emitBatch',
      url: 'http://test.env.mock/formats.csv',
      header: true,
      dynamicTyping: true,
      batchSize: '-5',
    };
    context.emit = sinon.spy();
    try {
      await readCSV.process.call(context, msg, cfg);
    } catch (err) {
      expect(err.message).to.be.equal('\'batchSize\' must be a positive integer!');
    }
  });

  it('emitBehavior: emitBehavior, batchSize is string', async () => {
    cfg = {
      emitBehavior: 'emitBatch',
      url: 'http://test.env.mock/formats.csv',
      header: true,
      dynamicTyping: true,
      batchSize: 'asd',
    };
    context.emit = sinon.spy();
    try {
      await readCSV.process.call(context, msg, cfg);
    } catch (err) {
      expect(err.message).to.be.equal('\'batchSize\' must be a positive integer!');
    }
  });

  it('emitBehavior: emitIndividually, header: false, dynamicTyping: false', async () => {
    cfg = {
      emitBehavior: 'emitIndividually',
      url: 'http://test.env.mock/formats.csv',
      header: false,
      dynamicTyping: false,
    };
    context.emit = sinon.spy();
    await readCSV.process.call(context, msg, cfg);

    expect(context.emit.callCount)
      .to.equal(3); // 3 emit calls

    expect(context.emit.getCall(1).args[1].body.column0)
      .to.equal('2.71828'); // result is number as string
  });

  it('Should fail - no File', async () => {
    cfg = {};
    context.emit = sinon.spy();
    await readCSV.process.call(context, msg, cfg).catch((error) => {
      expect(error.message).to.equal('URL of the CSV is missing');
    });
  });
});
