/* eslint-disable no-restricted-syntax,semi,comma-dangle,class-methods-use-this */

const { AttachmentProcessor } = require('@elastic.io/component-commons-library')
const { Writable } = require('stream');
const { messages } = require('elasticio-node')
const stream = require('stream')
const util = require('util')
const papa = require('papaparse')

const pipeline = util.promisify(stream.pipeline);
const attachmentProcessor = new AttachmentProcessor()

// transform array to obj, for example:
// ['aa', 'bb', 'cc'] => {column0: 'aa', column1: 'bb', column2: 'cc'}
function arrayToObj(arr) {
  let columns = {}
  arr.forEach((value, index) => {
    columns = { ...columns, ...{ [`column${index}`]: value } }
  })
  return columns
}

async function errHelper(text) {
  await this.logger.error(text)
  await this.emit('error', text)
  await this.emit('end')
}

function sliceIntoChunks(arr, chunkSize) {
  const res = [];
  for (let i = 0; i < arr.length; i += chunkSize) {
    const chunk = arr.slice(i, i + chunkSize);
    res.push(chunk);
  }
  return res;
}

async function readCSV(msg, cfg) {
  const that = this
  const emitBehavior = cfg.emitAll;
  const { body } = msg;

  // check if url provided in msg
  if (body.url && body.url.length > 0) {
    this.logger.info('URL found')
  } else {
    await errHelper.call(this, 'URL of the CSV is missing')
    return
  }

  if (body.header !== undefined
    && body.header !== ''
    && (typeof body.header) !== 'boolean') {
    await errHelper.call(this, 'Non-boolean values are not supported by "Contains headers" field')
    return
  }

  if (body.dynamicTyping !== undefined
    && body.dynamicTyping !== ''
    && (typeof body.dynamicTyping) !== 'boolean') {
    await errHelper.call(this, 'Non-boolean values are not supported by "Convert Data types" field')
    return
  }

  const parseOptions = {
    header: body.header,
    dynamicTyping: body.dynamicTyping,
    delimiter: body.delimiter
  }

  // if set "Fetch All" create object with results
  const result = [];

  let dataStream
  const parseStream = papa.parse(papa.NODE_STREAM_INPUT, parseOptions)

  try {
    dataStream = await attachmentProcessor.getAttachment(body.url, 'stream')
    this.logger.info('File received, trying to parse CSV')
  } catch (err) {
    this.logger.error(`URL - "${body.url}" unreachable: ${err}`);
    this.emit('error', `URL - "${body.url}" unreachable: ${err}`)
    this.emit('end')
    return
  }
  // control of node data stream
  class CsvWriter extends Writable {
    async write(chunk) {
      let data = {}
      if (parseOptions.header) {
        data = chunk
      } else {
        data = arrayToObj(chunk)
      }
      if (emitBehavior === 'emitIndividually' || cfg.emitAll === false || cfg.emitAll === 'false') {
        parseStream.pause()
        await that.emit('data', messages.newMessageWithBody(data))
        parseStream.resume()
      } else {
        result.push(data)
      }
    }
  }
  const writerStream = new CsvWriter()
  writerStream.logger = this.logger

  try {
    await pipeline(
      dataStream.data,
      parseStream,
      writerStream
    )
    this.logger.info('File parsed successfully')
  } catch (err) {
    this.logger.error(`error during file parse: ${err}`);
    this.emit('error', `error during file parse: ${err}`)
    this.emit('end')
    return
  }

  if (emitBehavior === 'fetchAll' || cfg.emitAll === true || cfg.emitAll === 'true') {
    await this.emit('data', messages.newMessageWithBody({ result }))
  } else if (emitBehavior === 'emitBatch') {
    const { batchSize } = body;
    if (!isPositiveInteger(batchSize)) {
      throw new Error("'batchSize' must be a positive integer!");
    }
    const chunks = sliceIntoChunks(result, batchSize);
    // eslint-disable-next-line no-plusplus
    for (let i = 0; i < chunks.length; i++) {
      // eslint-disable-next-line no-await-in-loop
      await this.emit('data', messages.newMessageWithBody({ result: chunks[i] }))
    }
  }
  this.logger.info(`Complete, memory used: ${process.memoryUsage().heapUsed / 1024 / 1024} Mb`)
}

module.exports.process = readCSV;
module.exports.getMetaModel = async function getMetaModel(cfg) {
  const meta = {
    in: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          required: true,
          title: 'URL'
        },
        header: {
          type: 'boolean',
          required: false,
          title: 'Contains headers'
        },
        delimiter: {
          type: 'string',
          required: false,
          title: 'Delimiter'
        },
        dynamicTyping: {
          type: 'boolean',
          required: false,
          title: 'Convert Data types'
        }
      }
    },
    out: {}
  };

  if (cfg.emitAll === 'emitBatch') {
    meta.in.properties.batchSize = {
      title: 'Batch Size',
      type: 'number',
      required: true
    }
  }
  return meta;
}

function isPositiveInteger(input) {
  return Number.isSafeInteger(input) && input > 0;
}
