import { pushStream } from 'dynamodb-stream-elasticsearch';

const { ES_ENDPOINT } = process.env;

const esDomain = {
    index: 'entitiessearchindex',
    doctype: '_doc'
};

export function main(event, context, callback) {
  console.log('Received event:', JSON.stringify(event, null, 2));
  pushStream({ event, endpoint: ES_ENDPOINT, index: esDomain.index, type: esDomain.doctype })
    .then(() => {
        console.info(`Successfully processed ${event.Records.length} records.`);
    })
    .catch((e) => {
        console.info(`Error ${e}`);
    });
}