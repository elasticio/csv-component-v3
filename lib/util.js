const papa = require('papaparse');
const packageJson = require('../package.json');
const compJson = require('../component.json');

function getUserAgent() {
  const { name: compName } = packageJson;
  const { version: compVersion } = compJson;
  const libVersion = packageJson.dependencies['@elastic.io/component-commons-library'];
  return `${compName}/${compVersion} component-commons-library/${libVersion}`;
}

function getItemsProperties(cfg) {
  const properties = {};
  const delimiter = cfg.separator ? cfg.separator : ',';
  // eslint-disable-next-line
  const fields = papa.parse(cfg.order, { delimiter }).data[0].map(x => { return x.trim() });
  fields.forEach((element) => {
    properties[element] = {
      type: 'string',
      required: false,
      title: element,
    };
  });
  return properties;
}

function getOut(cfg) {
  let out;

  if (cfg.uploadToAttachment) {
    out = {
      type: 'object',
      properties: {
        attachmentUrl: {
          type: 'string',
          required: true,
          title: 'A URL to the CSV',
        },
        type: {
          type: 'string',
          required: true,
          title: 'File type',
        },
        size: {
          type: 'number',
          required: true,
          title: 'Size in bytes',
        },
        attachmentCreationTime: {
          type: 'string',
          required: true,
          title: 'When generated',
        },
        contentType: {
          type: 'string',
          required: true,
          title: 'Content type',
        },
      },
    };
  } else {
    out = {
      type: 'object',
      properties: {
        csvString: {
          type: 'string',
          required: true,
          title: 'CSV as a string',
        },
      },
    };
  }

  return out;
}

module.exports.getUserAgent = getUserAgent;
module.exports.getItemsProperties = getItemsProperties;
module.exports.getOut = getOut;
