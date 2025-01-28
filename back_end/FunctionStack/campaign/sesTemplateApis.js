// export const createSesEmailTemplate = async (data, isObjParam = false) => {
//     const retVal = validateFields("ses_email_template", data);
//     if (retVal === "") {
//       try {
//         console.log(`params: ${JSON.stringify(data)}`);
//         const createSesEmailTemplateResponse = await ses
//           .createTemplate(data)
//           .promise();
//         console.log(
//           `createSesEmailTemplateResponse: ${JSON.stringify(
//             createSesEmailTemplateResponse
//           )}`
//         );
//         if (isObjParam) {
//           createSesEmailTemplateResponse.status = true;
//           return createSesEmailTemplateResponse;
//         }
//         return success({ status: true, createSesEmailTemplateResponse });
//       } catch (e) {
//         console.log(`createSesEmailTemplateResponse: ${JSON.stringify(e)}`);
//         if (isObjParam) {
//           return e;
//         }
//         return badRequest({ status: false, error: e });
//       }
//     } else {
//       return failure({ status: false, error: "Validation Failed", retVal });
//     }
//   };
  
//   export const getSesEmailTemplate = async (data, isJSONOnly = false) => {
//     console.log(`params: ${JSON.stringify(data)}`);
//     if (!data.TemplateName)
//       return badRequest({ status: false, error: "TemplateName Required" });
  
//     try {
//       const getSesEmailTemplateResponse = await ses.getTemplate(data).promise();
//       console.log(
//         `getSesEmailTemplateResponse: ${JSON.stringify(
//           getSesEmailTemplateResponse
//         )}`
//       );
//       const split = getSesEmailTemplateResponse.Template.TemplateName.split("_");
//       const isActive = split[split.length - 1] === "active";
//       getSesEmailTemplateResponse.tags = {
//         app: "crm",
//         isActive,
//       };
//       getSesEmailTemplateResponse.type = "ses";
//       if (isJSONOnly) {
//         return getSesEmailTemplateResponse;
//       }
//       return success({ status: true, getSesEmailTemplateResponse });
//     } catch (e) {
//       console.log(`getSesEmailTemplateResponse: ${JSON.stringify(e)}`);
//       if (isJSONOnly) {
//         return e;
//       }
  
//       return badRequest({ status: false, error: e });
//     }
//   };
  
//   export const deleteSesEmailTemplate = async (data, isJSONOnly = false) => {
//     console.log(`params: ${JSON.stringify(data)}`);
//     try {
//       if (!data.TemplateName)
//         return badRequest({ status: false, error: "TemplateName Required" });
//       const deleteSesEmailTemplateResponse = await ses
//         .deleteTemplate(data)
//         .promise();
//       console.log(
//         `deleteSesEmailTemplateResponse: ${JSON.stringify(
//           deleteSesEmailTemplateResponse
//         )}`
//       );
//       if (isJSONOnly) {
//         deleteSesEmailTemplateResponse.status = true;
//         return deleteSesEmailTemplateResponse;
//       }
  
//       return success({ status: true, deleteSesEmailTemplateResponse });
//     } catch (e) {
//       console.log(`deleteSesEmailTemplateResponse: ${JSON.stringify(e)}`);
//       if (isJSONOnly) {
//         return e;
//       }
  
//       return badRequest({ status: false, error: e });
//     }
//   };
  
//   export const updateSesEmailTemplate = async (data) => {
//     const retVal = validateFields("ses_email_template", data);
//     if (retVal === "") {
//       try {
//         console.log(`params: ${JSON.stringify(data)}`);
//         const getTemplate = await getSesEmailTemplate(
//           { TemplateName: data?.Template?.TemplateName },
//           true
//         );
//         console.log(`getTemplate: ${JSON.stringify(getTemplate)}`);
//         if (getTemplate && getTemplate?.Template?.TemplateName) {
//           const updateSesEmailTemplateResponse = await ses
//             .updateTemplate(data)
//             .promise();
//           console.log(
//             `updateSesEmailTemplateResponse: ${JSON.stringify(
//               updateSesEmailTemplateResponse
//             )}`
//           );
  
//           return success({ status: true, updateSesEmailTemplateResponse });
//         }
//         const createTemp = await createSesEmailTemplate(data, true);
//         console.log(`createTemp: ${JSON.stringify(createTemp)}`);
//         if (createTemp?.status) {
//           const split = data?.Template?.TemplateName.split("_");
//           const isActive = split[split.length - 1] === "active";
//           const deleteOldTemp = await deleteSesEmailTemplate(
//             {
//               TemplateName: isActive
//                 ? data?.Template?.TemplateName.replace("active", "inactive")
//                 : data?.Template?.TemplateName.replace("inactive", "active"),
//             },
//             true
//           );
//           if (!deleteOldTemp.status) {
//             return badRequest({
//               status: false,
//               error: "Template updation failed",
//             });
//           }
//           return success({ status: true });
//         }
  
//         return badRequest({
//           status: false,
//           error: "Template updation failed",
//         });
//       } catch (e) {
//         console.log(`updateSesEmailTemplateResponse: ${JSON.stringify(e)}`);
//         return badRequest({ status: false, error: e });
//       }
//     } else {
//       return failure({ status: false, error: "Validation Failed", retVal });
//     }
//   };
  
//   export const listSesTemplate = async (data, isJSONOnly = false) => {
//     console.log(`params: ${JSON.stringify(data)}`);
//     try {
//       const filteredData = [];
//       // listing the SES templates
//       let sesTemplateList = await listSesTemplates();
//       sesTemplateList = sesTemplateList.filter((item) =>
//         item.Name.startsWith(data.hbid)
//       );
//       for (const item of sesTemplateList) {
//         const split = item.Name.split("_");
//         const isActive = split[split.length - 1] === "active";
//         filteredData.push({
//           ...item,
//           type: "ses",
//           tags: {
//             app: "crm",
//             hbid: data.hbid,
//             isActive,
//           },
//         });
//       }
//       if (isJSONOnly) {
//         return { status: true, data: filteredData };
//       }
  
//       return success({ status: true, data: filteredData });
//     } catch (e) {
//       if (isJSONOnly) {
//         return { status: false, error: e.stack };
//       }
//       return failure({ status: false, error: e.stack });
//     }
//   };
  
// const listSesTemplates = async () => {
//     const list = [];
//     try {
//       let params;
//       let hasNext = true;
//       let NextToken;
//       while (hasNext) {
//         params = NextToken ? { MaxItems: 100, NextToken } : { MaxItems: 100 };
//         const listTemplateResponse = await ses.listTemplates(params).promise();
//         console.log(
//           `listTemplateResponse: ${JSON.stringify(listTemplateResponse)}`
//         );
//         if (
//           listTemplateResponse.TemplatesMetadata &&
//           listTemplateResponse.TemplatesMetadata.length
//         )
//           list.push(...listTemplateResponse.TemplatesMetadata);
//         NextToken = listTemplateResponse?.NextToken || null;
//         hasNext = !!NextToken;
//       }
//       console.log("List: ", JSON.stringify(list));
//     } catch (error) {
//       console.log(`listSesTemplates error : ${JSON.stringify(error.stack)}`);
//       return list;
//     }
//     return list;
//   };