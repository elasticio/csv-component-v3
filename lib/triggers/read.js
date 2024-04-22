/* eslint-disable no-restricted-syntax,semi,comma-dangle,class-methods-use-this */

const { AttachmentProcessor } = require('@elastic.io/component-commons-library')
const { Writable } = require('stream');
const { messages } = require('elasticio-node')
const stream = require('stream')
const util = require('util')
const papa = require('papaparse')
const { getUserAgent } = require('../util');

const pipeline = util.promisify(stream.pipeline);

// transform array to obj, for example:
// ['aa', 'bb', 'cc'] => {column0: 'aa', column1: 'bb', column2: 'cc'}
function arrayToObj(arr) {
  let columns = {}
  arr.forEach((value, index) => {
    columns = { ...columns, ...{ [`column${index}`]: value } }
  })
  return columns
}

async function readCSV(msg, cfg) {
  const that = this;
  const {
    url,
    header,
    delimiter,
    dynamicTyping,
    emitBehavior,
    batchSize,
    skipEmptyLines,
    comments
  } = cfg;

  if (emitBehavior === 'emitBatch') {
    if (!isPositiveInteger(batchSize)) {
      throw new Error("'batchSize' must be a positive integer!");
    }
  }
  if (!url) throw new Error('URL of the CSV is missing');

  const parseOptions = {
    header,
    dynamicTyping,
    delimiter,
    skipEmptyLines,
    comments,
  }

  // if set "Fetch All" create object with results
  const result = [];

  let dataStream;
  const parseStream = papa.parse(papa.NODE_STREAM_INPUT, parseOptions);

  const attachmentProcessor = new AttachmentProcessor(getUserAgent(), msg.id);
  try {
    dataStream = await attachmentProcessor.getAttachment(url, 'stream')
    this.logger.info('File received, trying to parse CSV')
  } catch (err) {
    this.logger.error(`URL - "${url}" unreachable: ${err}`);
    await this.emit('error', `URL - "${url}" unreachable: ${err}`);
    return;
  }

  const buf = [];
  class CsvWriter extends Writable {
    async write(chunk) {
      let data = {}
      if (parseOptions.header) {
        data = chunk
      } else {
        data = arrayToObj(chunk)
      }
      if (emitBehavior === 'emitIndividually' || emitBehavior === false || emitBehavior === 'false' || emitBehavior === 'emitBatch') {
        parseStream.pause()
        if (emitBehavior === 'emitBatch') {
          buf.push(data);
          if (buf.length >= batchSize) await that.emit('data', messages.newMessageWithBody({ result: buf.splice(0, batchSize) }))
        } else {
          await that.emit('data', messages.newMessageWithBody(data))
        }
        parseStream.resume()
      } else {
        result.push(data)
      }
    }
  }
  const writerStream = new CsvWriter();
  writerStream.logger = this.logger;

  try {
    await pipeline(
      dataStream.data,
      parseStream,
      writerStream
    )
    this.logger.info('File parsed successfully')
  } catch (err) {
    this.logger.error(`error during file parse: ${err}`);
    await this.emit('error', `error during file parse: ${err}`)
    return;
  }

  if (emitBehavior === 'fetchAll') {
    await this.emit('data', messages.newMessageWithBody({ result }))
  } else if (emitBehavior === 'emitBatch' && buf.length > 0) {
    await that.emit('data', messages.newMessageWithBody({ result: buf }))
  }
  this.logger.info(`Complete, memory used: ${process.memoryUsage().heapUsed / 1024 / 1024} Mb`)
}

module.exports.process = readCSV;

function isPositiveInteger(input) {
  return Number.isSafeInteger(input) && input > 0;
}
