/* eslint-disable camelcase */
import { batchWriteItems } from "../../FunctionStack/libs/db";
import { getEntities } from "../fetchEntities/fetchEntities";

export async function main(event) {
  console.log(JSON.stringify(event));
  const { customer = "", idMappedValue = "", coBuyerLambdaArn = "" } = event;
  try {
    console.log("customer", JSON.stringify(customer));
    console.log("idMappedValue", JSON.stringify(idMappedValue));
    if (!customer || !idMappedValue)
      return {
        status: false,
      };

    let m_id = [];
    if (customer?.inte?.length) {
      for (const comm of customer.inte) {
        m_id.push(idMappedValue[comm]);
      }
    }
    m_id = [...new Set(m_id)]
    console.log("m_id", JSON.stringify(m_id));
    // fetching all cobuyers of customer
    const coBuyers = await getEntities(
      { id: customer.id, hbid: customer.hb_id },
      coBuyerLambdaArn
    );

    if (!coBuyers.status)
      return {
        status: false,
      };

    console.log("coBuyers", JSON.stringify(coBuyers));

    const batchParams = {
      RequestItems: {
        [process.env.entitiesTableName]: [
          {
            PutRequest: {
              Item: {
                ...customer,
                m_id,
              },
            },
          },
        ],
      },
    };

    for (const item of coBuyers.list) {
      batchParams.RequestItems[process.env.entitiesTableName].push({
        PutRequest: {
          Item: {
            ...item,
            m_id,
          },
        },
      });
    }

    console.log(`batchParams: ${JSON.stringify(batchParams)}`);
    const batchWriteResp = await batchWriteItems(batchParams);
    console.log(`batchWriteResp: ${JSON.stringify(batchWriteResp)}`);
    const batchWriteBody = batchWriteResp.body
      ? JSON.parse(batchWriteResp.body)
      : {};
    console.log(`batchWriteBody: ${JSON.stringify(batchWriteBody)}`);
    const unProcessedItems =
      batchWriteBody &&
      batchWriteBody.resp &&
      batchWriteBody.resp.UnprocessedItems
        ? batchWriteBody.resp.UnprocessedItems
        : {};
    console.log(`unProcessedItems: ${JSON.stringify(unProcessedItems)}`);
    const isBatchSuccess = !!(
      Object.entries(unProcessedItems).length === 0 &&
      unProcessedItems.constructor === Object
    );
    console.log(`isBatchSuccess: ${JSON.stringify(isBatchSuccess)}`);

    if (!isBatchSuccess)
      return {
        status: false,
      };

    return {
      status: true,
    };
  } catch (error) {
    console.log("error in updateCustomer Lambda", JSON.stringify(error.stack));
    return {
      status: false,
      error: error.message,
    };
  }
}
