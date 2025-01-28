import { invokeLambda } from "../../FunctionStack/libs/lambda";

const {AGENCY_LAMBDA_ARN}=process.env

export async function main(event) {
    try{
    console.log(`removeDuplicates :: ${JSON.stringify(event)}`);
    
    const invokeParam = {
      hb_id: event.hb_id,
      ...event.agencyInfo
    }
    const lambdaInvokeParams = {
      httpMethod: "POST",
        pathParameters: {
          action: "delete",
        },
        body: JSON.stringify({...invokeParam}, null, 2)
      };      
      try {
        
        const deleteLambdaResponse=await invokeLambda(AGENCY_LAMBDA_ARN,
                      lambdaInvokeParams)
    
        console.log("Delete Agencies Lambda response",deleteLambdaResponse);

        return {
            status: true,
            deleteLambdaResponse
          };
      } catch (error) {
        console.log("Error in delete agencies lambda :: ", error);
        throw error;
      }
    }catch(error){
        console.log('Cant delete the agent ',error)
        return {
          status: false,
          error
        }
    }
}