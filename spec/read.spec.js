process.env.REQUEST_MAX_RETRY = 0;
const { Logger } = require('@elastic.io/component-commons-library');
const { expect } = require('chai');
const nock = require('nock');
const sinon = require('sinon');
const readCSV = require('../lib/actions/read.js');

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
    .replyWithFile(200, `${__dirname}/../test/formats.csv`);

  // Previously "Fetch All" was true and "Emit Individually" was false
  // The next two tests check that this backwards compatability is preserved.
  describe('Backwards compatibility check', async () => {
    it('Fetch All', async () => {
      msg.body = {
        url: 'http://test.env.mock/formats.csv',
        header: true,
        dynamicTyping: true,
        delimiter: '',
      };
      cfg = {
        emitAll: 'true',
      };
      context.emit = sinon.spy();
      await readCSV.process.call(context, msg, cfg);

      expect(context.emit.callCount)
        .to.equal(1); // one emit call

      expect(context.emit.lastCall.firstArg)
        .to.equal('data'); // with data
    });

    it('emitAll: false, header: false, dynamicTyping: false', async () => {
      msg.body = {
        url: 'http://test.env.mock/formats.csv',
        header: false,
        dynamicTyping: false,
      };
      cfg = {
        emitAll: 'false',
      };
      context.emit = sinon.spy();
      await readCSV.process.call(context, msg, cfg);

      expect(context.emit.callCount)
        .to.equal(3); // 3 emit calls

      expect(context.emit.getCall(1).args[1].body.column0)
        .to.equal('2.71828'); // result is number as string
    });
  });

  describe('emitAll: emitBatch', async () => {
    it('should contain batchSize field', async () => {
      cfg = {
        emitAll: 'emitBatch',
      };
      const expectedMetadata = {
        in: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              required: true,
              title: 'URL',
            },
            header: {
              type: 'boolean',
              required: false,
              title: 'Contains headers',
            },
            delimiter: {
              type: 'string',
              required: false,
              title: 'Delimiter',
            },
            dynamicTyping: {
              type: 'boolean',
              required: false,
              title: 'Convert Data types',
            },
            batchSize: {
              title: 'Batch Size',
              type: 'number',
              required: true,
            },
          },
        },
        out: {},
      };
      const metadata = await readCSV.getMetaModel(cfg);
      expect(metadata).to.deep.equal(expectedMetadata);
    });
  });

  describe('emitAll: fetchAll', async () => {
    it('should not contain batchSize field', async () => {
      cfg = {
        emitAll: 'fetchAll',
      };
      const expectedMetadata = {
        in: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              required: true,
              title: 'URL',
            },
            header: {
              type: 'boolean',
              required: false,
              title: 'Contains headers',
            },
            delimiter: {
              type: 'string',
              required: false,
              title: 'Delimiter',
            },
            dynamicTyping: {
              type: 'boolean',
              required: false,
              title: 'Convert Data types',
            },
          },
        },
        out: {},
      };
      const metadata = await readCSV.getMetaModel(cfg);
      expect(metadata).to.deep.equal(expectedMetadata);
    });
  });

  it('One file', async () => {
    msg.body = {
      url: 'http://test.env.mock/formats.csv',
      header: true,
      dynamicTyping: true,
      delimiter: '',
    };
    cfg = {
      emitAll: 'fetchAll',
    };
    context.emit = sinon.spy();
    await readCSV.process.call(context, msg, cfg);

    expect(context.emit.callCount)
      .to.equal(1); // one emit call

    expect(context.emit.lastCall.firstArg)
      .to.equal('data'); // with data
  });

  it('emitAll: fetchAll, header: true, dynamicTyping: true', async () => {
    msg.body = {
      url: 'http://test.env.mock/formats.csv',
      header: true,
      dynamicTyping: true,
    };
    cfg = {
      emitAll: 'fetchAll',
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

  it('emitBatch: true, header: true, dynamicTyping: true', async () => {
    msg.body = {
      url: 'http://test.env.mock/formats.csv',
      header: true,
      dynamicTyping: true,
      batchSize: 1,
    };
    cfg = {
      emitAll: 'emitBatch',
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

  it('emitAll: emitIndividually, header: false, dynamicTyping: false', async () => {
    msg.body = {
      url: 'http://test.env.mock/formats.csv',
      header: false,
      dynamicTyping: false,
    };
    cfg = {
      emitAll: 'emitIndividually',
    };
    context.emit = sinon.spy();
    await readCSV.process.call(context, msg, cfg);

    expect(context.emit.callCount)
      .to.equal(3); // 3 emit calls

    expect(context.emit.getCall(1).args[1].body.column0)
      .to.equal('2.71828'); // result is number as string
  });

  it('Should fail - no File', async () => {
    msg.body = {
    };
    cfg = {
    };
    context.emit = sinon.spy();
    await readCSV.process.call(context, msg, cfg);
    expect(context.emit.getCall(0).firstArg).to.equal('error');
    expect(context.emit.getCall(0).lastArg).to.be.contains('URL of the CSV is missing');
  });

  it('Should fail - 404', async () => {
    msg.body = {
      url: 'https://example.com/1.csv',
      header: true,
    };
    cfg = {
      emitAll: 'fetchAll',
    };
    context.emit = sinon.spy();
    await readCSV.process.call(context, msg, cfg);
    expect(context.emit.getCall(0).firstArg).to.equal('error');
    expect(context.emit.getCall(0).lastArg).to.be.contains('status code 404');
  });

  it('Should fail - Non-boolean values - header', async () => {
    msg.body = {
      url: 'https://example.com/1.csv',
      header: 'asd',
    };
    cfg = {
      emitAll: 'fetchAll',
    };
    context.emit = sinon.spy();
    await readCSV.process.call(context, msg, cfg);
    expect(context.emit.getCall(0).firstArg).to.equal('error');
    expect(context.emit.getCall(0).lastArg).to.be.contains('Non-boolean values');
  });

  it('Should fail - Non-boolean values - dynamicTyping', async () => {
    msg.body = {
      url: 'https://example.com/1.csv',
      dynamicTyping: 'asd',
    };
    cfg = {
      emitAll: 'fetchAll',
    };
    context.emit = sinon.spy();
    await readCSV.process.call(context, msg, cfg);
    expect(context.emit.getCall(0).firstArg).to.equal('error');
    expect(context.emit.getCall(0).lastArg).to.be.contains('Non-boolean values');
  });
});
