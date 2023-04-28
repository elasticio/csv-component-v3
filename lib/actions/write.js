/* eslint-disable no-restricted-syntax,semi,comma-dangle,class-methods-use-this,
no-param-reassign */

const { AttachmentProcessor } = require('@elastic.io/component-commons-library')
const { messages } = require('elasticio-node')
const papa = require('papaparse')
const { Readable } = require('stream');
const { getUserAgent } = require('../util');

const formStream = (data) => {
  const stream = new Readable();
  stream.push(data);
  stream.push(null);
  return stream;
}

const TIMEOUT_BETWEEN_EVENTS = process.env.TIMEOUT_BETWEEN_EVENTS || 10000; // 10s;
const escapeSpecialChars = {
  n: '\n', t: '\t', r: '\r', b: '\b', f: '\f', v: '\v'
}

const rawData = []
let timeout

async function proceedData(data, msg, cfg) {
  let csvString;
  const {
    separator,
    header,
    newline,
    escapeFormulae
  } = cfg
  const delimiter = separator || ','

  const unparseOptions = {
    header,
    delimiter,
    newline: newline ? newline.replace(/\\[ntrbfv]/gm, (m) => escapeSpecialChars[m.slice(-1)]) : '\r\n',
    escapeFormulae
  }

  if (cfg.order) {
    // create fields array from string
    // eslint-disable-next-line
    const fields = papa.parse(cfg.order, { delimiter }).data[0].map(x => { return x.trim() })
    const orderedData = data.map((value) => {
      const result = fields.map((key) => {
        const filtered = value[key]
        return filtered
      })
      return result
    });
    csvString = papa.unparse({
      fields,
      data: orderedData
    }, unparseOptions);
  } else {
    csvString = papa.unparse(data, unparseOptions);
  }
  const getAttachment = () => formStream(csvString);

  if (!cfg.uploadToAttachment) {
    await this.emit('data', messages.newMessageWithBody({ csvString }))
    this.logger.info(`Complete, memory used: ${process.memoryUsage().heapUsed / 1024 / 1024} Mb`)
    return
  }

  const attachmentProcessor = new AttachmentProcessor(getUserAgent(), msg.id)
  let attachmentId;
  try {
    attachmentId = await attachmentProcessor.uploadAttachment(getAttachment)
  } catch (err) {
    this.logger.error(`Upload attachment failed: ${err}`)
    this.emit('error', `Upload attachment failed: ${err}`)
  }
  const attachmentUrl = attachmentProcessor.getMaesterAttachmentUrlById(attachmentId)
  const body = {
    attachmentUrl,
    type: '.csv',
    size: Buffer.byteLength(csvString),
    attachmentCreationTime: new Date(),
    contentType: 'text/csv'
  }
  const respData = messages.newMessageWithBody(body)

  respData.attachments = {
    'data.csv': {
      'content-type': body.contentType,
      size: body.size,
      url: body.attachmentUrl
    }
  }

  await this.emit('data', respData)
  this.logger.info(`Complete, memory used: ${process.memoryUsage().heapUsed / 1024 / 1024} Mb`)
  this.logger.info('Attachment created successfully')
}

async function writeCSV(msg, cfg) {
  const { body } = msg

  if (body.header !== undefined
    && body.header !== ''
    && (typeof body.header) !== 'boolean') {
    this.logger.error('Non-boolean values are not supported by "Include Headers" field')
    this.emit('error', 'Non-boolean values are not supported by "Include Headers" field')
    return
  }

  cfg.header = body.header

  // if not array - create array from all fn calls and send data to proceedData
  if (Array.isArray(body.items)) {
    this.logger.info('input metadata is array. Proceed with data ')
    await proceedData.call(this, body.items, msg, cfg)
  } else {
    rawData.push(body.items)
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => {
      this.logger.info(`input metadata is object. Array creation (wait up to ${TIMEOUT_BETWEEN_EVENTS}ms for more records)`)
      proceedData.call(this, rawData, msg, cfg)
    }, TIMEOUT_BETWEEN_EVENTS)
  }
}

module.exports.process = writeCSV
