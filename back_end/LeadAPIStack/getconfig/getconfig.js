/* import "core-js/stable";
import "regenerator-runtime/runtime"; */
import "../../NPMLayer/nodejs.zip";
import { listBuilders } from "../../FunctionStack/builders/builders";

const aws = require("aws-sdk");

const sfn = new aws.StepFunctions();
const { MACHINE_ARN } = process.env;
const initiateBuilderImport = async (builderConfig) => {
  let nextEvent = {
    ...builderConfig,
  };
  nextEvent = JSON.stringify(nextEvent);
  const params = {
    input: nextEvent,
    stateMachineArn: MACHINE_ARN,
  };
  console.log(`params: ${JSON.stringify(params)}`);
  const startExecutionResp = await sfn.startExecution(params).promise();
  console.log(`startExecutionResp: ${JSON.stringify(startExecutionResp)}`);
};
export async function main(event) {
  try {
    let hbidMappedConfig;
    console.log(JSON.stringify(event));
    // let { configCount, configsFileKey, index, restart } = event;
    let builderConfig;
    const { hb_id: hbId } = event;
    // Checking whether the event object has hb_id. If not this is the first execution
    if (!hbId) {
      // For the first execution
      const config = await listBuilders(true);
      console.log(`config: ${JSON.stringify(config)}`);
      // const config = [{ "hb_id": "05c49f13-1600-4b8d-abd8-51281ff2ec2f" }, { "hb_id": "3d777dbd-b5b2-4ee7-9076-dc93c6490812" }];
      hbidMappedConfig = config.map((builder) => {
        builder.hb_id = builder.id;
        return builder;
      });
      // Spawning new executions for every builder config except for the first, which is executed in the current one
      for (let i = 0; i < hbidMappedConfig.length; i += 1) {
        if (i === 0) {
          [builderConfig] = hbidMappedConfig;
        } else {
          await initiateBuilderImport(hbidMappedConfig[i]);
        }
      }
    } else {
      // For all the executions except for the first, event will contain the builder config
      builderConfig = { ...event };
    }
    // returning the config to
    return { ...builderConfig, configExists: !!builderConfig.hb_id };
  } catch (error) {
    console.log(`error: ${JSON.stringify(error)}`);
    return false;
  }
}
