import AWS from "aws-sdk";

const sqs = new AWS.SQS();
export const sendMessage = async (queueUrl, body) => {
  let response = null;
  try {
    const queueParams = {
      MessageBody: JSON.stringify(body),
      QueueUrl: queueUrl,
    };
    console.log(`queueParams: ${JSON.stringify(queueParams)}`);
    response = await sqs.sendMessage(queueParams).promise();
    console.log(`Queueresponse: ${JSON.stringify(response)}`);
  } catch (error) {
    console.log(`Exception occured in sqs sendMessage`);
    console.log(error);
  }
  return response;
};

export const deleteMessage = async (queueUrl, receiptHandle) => {
  let response = null;
  try {
    const queueParams = {
      QueueUrl: queueUrl,
      ReceiptHandle: receiptHandle,
    };
    console.log(`deleteQueueParams: ${JSON.stringify(queueParams)}`);
    response = await sqs.deleteMessage(queueParams).promise();
    console.log(`deleteQueueresponse: ${JSON.stringify(response)}`);
  } catch (error) {
    console.log(`Exception occured in sqs deleteMessage`);
    console.log(error);
  }
  return response;
};
