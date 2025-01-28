import "../../NPMLayer/nodejs.zip";
import { listCustomerElastic } from "../../FunctionStack/customers/customers";

export async function main(event) {
  const response = { doImport: false, ...event };
  try {
    console.log(`process leads event: ${JSON.stringify(event)}`);

    const { hb_id: hbId } = event;

    const { index, after, hasAfter, step } = event.iterator;

    if (hbId && hasAfter) {
      const requestBody = {
        hb_id: hbId,
        from: index,
        size: step,
        after,
        utype: "admin",
        sort: [
          {
            field: "fname",
            order: "asc",
          },
        ],
      };
      console.log(`requestBody: ${JSON.stringify(requestBody)}`);
      const listCustomerElasticRes = await listCustomerElastic(
        requestBody,
        true
      );
      console.log(
        `listCustomerElasticRes: ${JSON.stringify(listCustomerElasticRes)}`
      );

      if (
        listCustomerElasticRes &&
        listCustomerElasticRes.customers &&
        listCustomerElasticRes.customers.length
      ) {
        return {
          doImport: true,
          ...event,
          after: listCustomerElasticRes?.after,
          hasAfter: listCustomerElasticRes?.hasAfter,
          customersList: listCustomerElasticRes.customers.map(
            ({ _score, ...keepAttrs }) => keepAttrs
          ),
          hb_id: hbId,
          index,
          count: listCustomerElasticRes.totalResults,
        };
      }
    }
  } catch (error) {
    console.log(`process leads catch: ${JSON.stringify(error)}`);
  }
  return response;
}
