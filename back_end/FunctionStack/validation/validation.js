import moment from "moment-timezone";
import {
  batchGetResources,
  doPaginatedQueryEllastic,
  getParamsForQuery,
  getResourceJSON,
} from "../libs/db";
import { elasticExecuteQuery } from "../search/search";

const stages = ["Lead", "Prospect", "Buyer", "Closed", "Bust_Out", "Dead_Lead"];
// const desiredMoves = ["As soon as possible", "2-3 Months", "Over 3 Months"];

export const validatePhone = (phone, isApiV2 = false) => {

  if (isApiV2) {
    // Remove all non-numeric characters
    const cleaned = phone.replace(/\D/g, '');

    // Check if the cleaned number has exactly 10 digits
    if (cleaned.length !== 10) {
      return {
        isValid: false,
        error: 'Phone number must contain exactly 10 digits',
        formattedNumber: null
      };
    }

    // Check if the input matches any of the valid formats
    const validFormats = [
      /^\d{10}$/, // ##########
      /^\d{3}-\d{3}-\d{4}$/, // ###-###-####
      /^\(\d{3}\)\d{3}-\d{4}$/, // (###)###-####
      /^\((\d{3})\)[ ](\d{3})[-](\d{4})$/ // (###) ###-####
    ];

    const isValidFormat = validFormats.some(format =>
      format.test(phone.replace(/\s+/g, '')) // Remove spaces for testing
    );

    if (!isValidFormat) {
      return {
        isValid: false,
        error: 'Invalid phone number format. Acceptable formats: ###-###-####, ##########, (###)###-####',
        formattedNumber: null
      };
    }

    // Format to (###) ###-####
    const formatted = `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;

    return {
      isValid: true,
      error: null,
      formattedNumber: formatted
    };
  }

  const stringPhone = phone.toString();
  const lowerCasePhone = stringPhone.toLowerCase();
  const re = /^\((\d{3})\)[ ](\d{3})[-](\d{4})$/;

  return re.test(lowerCasePhone);
};
export const validateEmail = (email) => {
  const re = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,10}$/;
  return re.test(String(email).toLowerCase());
};
const checkAndRemoveDuplicateIds = (arr) => {
  console.log(`checkAndRemoveDuplicateIds: ${JSON.stringify(arr)}`);
  // Trim the id strings
  const trimmedArr = arr.map((item) => {
    if (item && typeof item === "string") return item.trim();
    return item;
  });
  console.log(`trimmedArr: ${JSON.stringify(trimmedArr)}`);
  // Remove the duplicate ids
  const uniqueArr = [...new Set(trimmedArr)];
  console.log(`uniqueArr: ${JSON.stringify(uniqueArr)}`);
  return uniqueArr;
};
// Check whether each supplied id is present in the returned response
const validateId = (id, arr, key = "") => arr.some(val => {
  if (key) {
    const entityName = val.entity.split("#")[0];
    return entityName === key && val.id === id;
  }
  return val.id === id;
});
// isExternal - if true, only basic validations are performed
export const validateIdFieldsForExternal = async (data, isExternal) => {
  console.log(`validateIdFieldsForExternal: ${JSON.stringify(data)}`);
  try {
    // Validate the ids supplied in the request
    const params = {
      RequestItems: {
        /* required */
        [process.env.entitiesTableName]: {
          Keys: [],
          AttributesToGet: ["id", "entity"],
        },
      },
    };
    const hbId = data && data.hb_id ? data.hb_id.toString() : "";
    const interests =
      data && data.inte ? checkAndRemoveDuplicateIds(data.inte) : [];
    const influences =
      data && data.infl ? checkAndRemoveDuplicateIds(data.infl) : [];
    const source = data && data.psrc ? data.psrc.toString() : "";
    const grade = data && data.grade ? data.grade.toString() : "";
    const desf = data && data.desf ? checkAndRemoveDuplicateIds(data.desf) : [];
    const contactMethod = data && data.cntm ? data.cntm.toString() : "";
    const questions = data && data.dgraph_list ? data.dgraph_list : [];
    const desmId = data && data.desm ? data.desm.toString() : "";

    console.log(`dgraph_list: ${JSON.stringify(questions)}`);

    for (const interestId of interests) {
      params.RequestItems[process.env.entitiesTableName].Keys.push({
        id: interestId.toString(),
        entity: `community#${hbId}`,
      });
    }
    for (const influenceId of influences) {
      params.RequestItems[process.env.entitiesTableName].Keys.push({
        id: influenceId.toString(),
        entity: `infl#${hbId}`,
      });
    }
    for (const question of questions) {
      params.RequestItems[process.env.entitiesTableName].Keys.push({
        id: question && question.qstn_id ? question.qstn_id.toString() : "",
        entity: `question#${hbId}#customer`,
      });
    }
    if (source.length) {
      params.RequestItems[process.env.entitiesTableName].Keys.push({
        id: source.toString(),
        entity: `psrc#${hbId}`,
      });
    }
    if (grade.length) {
      params.RequestItems[process.env.entitiesTableName].Keys.push({
        id: grade.toString(),
        entity: `grade#${hbId}`,
      });
    }
    for (const desfId of desf) {
      params.RequestItems[process.env.entitiesTableName].Keys.push({
        id: desfId.toString(),
        entity: `desf#${hbId}`,
      });
    }
    if (contactMethod.length) {
      params.RequestItems[process.env.entitiesTableName].Keys.push({
        id: contactMethod.toString(),
        entity: `cntm#${hbId}`,
      });
    }
    if (desmId.length) {
      params.RequestItems[process.env.entitiesTableName].Keys.push({
        id: desmId.toString(),
        entity: `desm#${hbId}`,
      });
    }
    // console.log('params: ', JSON.stringify(params));
    if (params.RequestItems[process.env.entitiesTableName].Keys.length) {
      const resourceValidationResponse = await batchGetResources(params, true);
      console.log(
        `resourceValidationResponse: ${JSON.stringify(
          resourceValidationResponse
        )}`
      );
      const resourceValidationResp =
        resourceValidationResponse &&
          resourceValidationResponse.statusCode === 200 &&
          resourceValidationResponse.body
          ? JSON.parse(resourceValidationResponse.body)
          : [];
      console.log(
        `resourceValidationResp: ${JSON.stringify(resourceValidationResp)}`
      );
      // Check whether each supplied id is present in the returned response

      let validInterest = false;
      for (const interestId of interests) {
        validInterest = validateId(interestId, resourceValidationResp, "community");
        if (!validInterest) {
          break;
        }
      }
      let validInfluence = false;
      for (const influenceId of influences) {
        validInfluence = validateId(influenceId, resourceValidationResp, "infl");
        if (!validInfluence) {
          break;
        }
      }
      let validDesf = false;
      for (const desfId of desf) {
        validDesf = validateId(desfId, resourceValidationResp, "desf");
        if (!validDesf) {
          break;
        }
      }
      let validQuestion = false;
      for (const question of questions) {
        validQuestion = validateId(
          question && question.qstn_id ? question.qstn_id : "",
          resourceValidationResp, "question"
        );
        if (!validQuestion) {
          break;
        }
      }

      const validSource = source.length
        ? validateId(source, resourceValidationResp, "psrc")
        : true;
      const validGrade = grade.length
        ? validateId(grade, resourceValidationResp, "grade")
        : true;
      const validcontactMethod = contactMethod.length
        ? validateId(contactMethod, resourceValidationResp, "cntm")
        : true;
      const validDesmId = desmId.length
        ? validateId(desmId, resourceValidationResp, "desm")
        : true;

      /* console.log(`validSource: ${validSource}`);
      console.log(`validGrade: ${validGrade}`);
      console.log(`validcontactMethod: ${validcontactMethod}`);
      
      console.log(`validDesf: ${validDesf}`);
      console.log(`validInterest: ${validInterest}`);
      console.log(`validInfluence: ${validInfluence}`);
      console.log(`validDesmId: ${validDesmId}`);
      console.log(`validQuestion: ${validQuestion}`); */

      const errors = [];
      const fields = [];
      if (!validSource && !isExternal) {
        fields.push("psrc");
        errors.push("psrc field contains invalid value");
      }
      if (!validGrade && !isExternal) {
        fields.push("grade");
        errors.push("grade field contains invalid value");
      }
      if (!validcontactMethod && !isExternal) {
        fields.push("cntm");
        errors.push("cntm field contains invalid value");
      }
      if (!validDesf && desf && desf.length && !isExternal) {
        fields.push("desf");
        errors.push("desf field contains invalid value");
      }
      if (!validInterest && interests && interests.length && !isExternal) {
        fields.push("inte");
        errors.push("inte field contains invalid value(s)");
      }
      if (!validInfluence && influences && influences.length && !isExternal) {
        fields.push("infl");
        errors.push("infl field contains invalid value(s)");
      }
      if (!validQuestion && questions && questions.length && !isExternal) {
        fields.push("dgraph_list.qstn_id");
        errors.push("dgraph_list field contains invalid value(s) for qstn_id");
      }
      if (!validDesmId && !isExternal) {
        fields.push("desm");
        errors.push("desm field contains invalid value");
      }
      return { msg: errors, field: fields };
    }

    // There are no fields to check validity of the id.
    // This usually happens in the case of External API Lead Import
    // There returning blank msg and field
    return { msg: [], field: [] };
  } catch (error) {
    return { msg: [error], field: [] };
  }
};

export const validateIdFieldsForExternalRealtor = async (data) => {
  try {
    // Validate the ids supplied in the request
    const params = {
      RequestItems: {
        /* required */
        [process.env.entitiesTableName]: {
          Keys: [],
          AttributesToGet: ["id", "entity"],
        },
      },
    };
    const hbId = data && data.hb_id ? data.hb_id.toString() : "";
    const source = data && data.psrc ? data.psrc.toString() : "";
    const influences =
      data && data.infl ? checkAndRemoveDuplicateIds(data.infl) : [];
    const contactMethod = data && data.cntm ? data.cntm.toString() : "";
    const expertices =
      data && data.exp ? checkAndRemoveDuplicateIds(data.exp) : [];
    const specialities =
      data && data.spec ? checkAndRemoveDuplicateIds(data.spec) : [];
    const questions = data && data.dgraph_list ? data.dgraph_list : [];
    const agencyId = data && data.agency_id ? data.agency_id.toString() : "";

    if (source.length) {
      params.RequestItems[process.env.entitiesTableName].Keys.push({
        id: source.toString(),
        entity: `psrc#${hbId}`,
      });
    }
    if (agencyId.length) {
      params.RequestItems[process.env.entitiesTableName].Keys.push({
        id: agencyId.toString(),
        entity: `agency#${hbId}`,
      });
    }
    for (const influenceId of influences) {
      params.RequestItems[process.env.entitiesTableName].Keys.push({
        id: influenceId.toString(),
        entity: `infl#${hbId}`,
      });
    }
    if (contactMethod.length) {
      params.RequestItems[process.env.entitiesTableName].Keys.push({
        id: contactMethod.toString(),
        entity: `cntm#${hbId}`,
      });
    }
    for (const experticeId of expertices) {
      params.RequestItems[process.env.entitiesTableName].Keys.push({
        id: experticeId.toString(),
        entity: `exp#${hbId}`,
      });
    }
    for (const specialitiesId of specialities) {
      params.RequestItems[process.env.entitiesTableName].Keys.push({
        id: specialitiesId.toString(),
        entity: `spec#${hbId}`,
      });
    }
    for (const question of questions) {
      params.RequestItems[process.env.entitiesTableName].Keys.push({
        id: question && question.qstn_id ? question.qstn_id.toString() : "",
        entity: `question#${hbId}#realtor`,
      });
    }

    // console.log('params: ', JSON.stringify(params));
    const resourceValidationResponse = await batchGetResources(params, true);
    // console.log(`resourceValidationResponse: ${JSON.stringify(resourceValidationResponse)}`);
    const resourceValidationResp =
      resourceValidationResponse &&
        resourceValidationResponse.statusCode === 200 &&
        resourceValidationResponse.body
        ? JSON.parse(resourceValidationResponse.body)
        : [];
    // console.log(`resourceValidationResp: ${JSON.stringify(resourceValidationResp)}`);

    let validInfluence = false;
    for (const influenceId of influences) {
      validInfluence = validateId(influenceId, resourceValidationResp, "infl");
      if (!validInfluence) {
        break;
      }
    }
    let validExpertice = false;
    for (const experticesId of expertices) {
      validExpertice = validateId(experticesId, resourceValidationResp, "exp");
      if (!validExpertice) {
        break;
      }
    }
    let validSepciality = false;
    for (const specialitiesId of specialities) {
      validSepciality = validateId(specialitiesId, resourceValidationResp, "spec");
      if (!validSepciality) {
        break;
      }
    }
    let validQuestion = false;
    for (const question of questions) {
      validQuestion = validateId(
        question && question.qstn_id ? question.qstn_id : "",
        resourceValidationResp, "question"
      );
      if (!validQuestion) {
        break;
      }
    }

    const validSource = source.length
      ? validateId(source, resourceValidationResp, "psrc")
      : true;
    const validAgencyId = agencyId.length
      ? validateId(agencyId, resourceValidationResp, "agency")
      : true;
    const validcontactMethod = contactMethod.length
      ? validateId(contactMethod, resourceValidationResp, "cntm")
      : true;

    const errors = [];
    const fields = [];
    if (!validSource) {
      fields.push("psrc");
      errors.push("psrc field contains invalid value");
    }
    if (!validAgencyId) {
      fields.push("agency_id");
      errors.push("agency_id field contains invalid value");
    }
    if (!validInfluence && influences && influences.length) {
      fields.push("infl");
      errors.push("infl field contains invalid value(s)");
    }
    if (!validcontactMethod) {
      fields.push("cntm");
      errors.push("cntm field contains invalid value");
    }
    if (!validExpertice && expertices && expertices.length) {
      fields.push("exp");
      errors.push("exp field contains invalid value(s)");
    }
    if (!validSepciality && specialities && specialities.length) {
      fields.push("spec");
      errors.push("spec field contains invalid value(s)");
    }
    if (!validQuestion && questions && questions.length) {
      fields.push("dgraph_list.qstn_id");
      errors.push("dgraph_list field contains invalid value(s) for qstn_id");
    }

    return { msg: errors, field: fields };
  } catch (error) {
    return { msg: [error], field: [] };
  }
};
const containsInvalidCharacters = (value) => !/^[a-zA-Z0-9 '-]*$/.test(value);
// isExternal - if set to true, do only basic validation
export const validateFields = (section, values, isExternal = false, requiredFields = {}) => {
  const isMessaging = values?.isSns ? values?.isSns : false;
  console.log(`isMessaging: ${isMessaging}`);
  console.log(`requiredFields: ${JSON.stringify(requiredFields)}`);
  let errors = {};
  const checkEmptyError = () => {
    if (Object.keys(errors).length === 0) {
      errors = "";
    }
    // console.log('errors: ', errors);
  };
  console.log(`section: ${section}`);
  console.log("values: ", values);
  const commonSections = ["customer", "co_buyer", "realtor", "broker"];
  if (commonSections.includes(section)) {
    const fname = values.fname ? values.fname.trim() : "";
    const lname = values.lname ? values.lname.trim() : "";
    // const isValidFname = section === "broker" ? requiredFields?.broker?.fname :requiredFields?.fname; 
    // const isValidlname = section === "broker" ? requiredFields?.broker?.lname :requiredFields?.lname; 
    if (requiredFields?.fname ?? true) {
      if (!fname && !isExternal) {
        errors.fname = "First Name Required";
      }
    }
    if (requiredFields?.lname ?? true) {
      if (!lname && !isExternal) {
        errors.lname = "Last Name Required";
      }
    }
    console.log(`Before containsInvalidCharacters fname: ${fname}`);
    // Check whether there are invalid characters in the name fields
    // if (containsInvalidCharacters(fname)) {
    //   console.log(`In containsInvalidCharacters fname`);
    //   errors.fname = "First name contains invalid characters";
    // }
    // console.log(`Before containsInvalidCharacters lname: ${lname}`);
    // if (containsInvalidCharacters(lname)) {
    //   console.log(`In containsInvalidCharacters lname`);
    //   errors.lname = "Last name contains invalid characters";
    // }
    if (fname.length > 50) {
      errors.fname = "Maximum length exceeds 50";
    }
    if (lname.length > 50) {
      errors.lname = "Maximum length exceeds 50";
    }
    if (!values.email) {
      if (requiredFields.email ?? true) {
        errors.email = "Email Required";
      };
    } else if (!validateEmail(values.email)) {
      errors.email = `Invalid Email Address`;
    }
    const isPhoneValid = values.phone ? validatePhone(values.phone) : false;
    console.log(`isPhoneValid: ${isPhoneValid}`);
    if (!values.phone && !isExternal && !isMessaging) {
      if (requiredFields.phone ?? true) {
        errors.phone = "Phone Required";
      }
    } else if (!isPhoneValid && !isExternal && !isMessaging) {
      errors.phone = `Invalid Phone Number`;
    }
    if (!values.hb_id) {
      errors.hb_id = "Home Builder ID Required";
    }
  }

  const commonSections2 = ["realtor", "broker"];
  if (commonSections2.includes(section)) {
    if (!values.rel_id && !isMessaging) {
      if (requiredFields.rel_id ?? true) {
        errors.rel_id = "Relationship ID Required";
      }
    }
  }

  const commonSections3 = ["customer", "realtor"];
  if (commonSections3.includes(section) && !isExternal && !isMessaging) {
    if (!values.psrc) {
      if (requiredFields.psrc ?? true) {
        errors.psrc = "Primary Source Required";
      }
    }
    if (!values.cntm) {
      if (requiredFields.cntm ?? true) {
        errors.cntm = "Contact Method Required";
      }
    }
  }

  const commonActivitySections = ["appointment", "call", "note", "task"];
  if (commonActivitySections.includes(section)) {
    if (!values.acti.sub.trim()) {
      errors.sub = "Subject Required";
    }
    if (!values.acti.note) {
      errors.note = "Note Required";
    }
  }

  const commonActivitySections2 = ["appointment", "call", "task"];
  if (commonActivitySections2.includes(section) && !isMessaging) {
    if (!values.acti.dt) {
      errors.dt = "Date Required";
    }
  }

  const commonActivitySections3 = ["appointment", "call"];
  if (commonActivitySections3.includes(section) && !isMessaging) {
    if (!values.acti.dur) {
      errors.dur = "Duration Required";
    }
  }
  // let isDesmValid;
  switch (section) {
    case "customer":
      if (!values.grade && !isExternal && !isMessaging) {
        if (requiredFields.grade ?? true) {
          errors.grade = "Grade Required";
        }
      }
      if (!values.stage && !isExternal) {
        if (requiredFields.stage ?? true) {
          errors.stage = "Stage Required";
        }
      } else if (!stages.includes(values.stage)) {
        if (!errors.stage) {
          errors.stage = "";
        }
        errors.stage += `Invalid stage. Expected values: ${stages}`;
      }
      // isDesmValid = desiredMoves.includes(values.desm);
      // // console.log(`isDesmValid: ${isDesmValid}`);
      // if (values.desm && !isDesmValid && !isMessaging) {
      //   if (!errors.desm) {
      //     errors.desm = "";
      //   }
      //   errors.desm += `Invalid desired move. Expected values: ${desiredMoves}`;
      // }
      break;
    case "agency":
      if (!values.tname || !values.tname.trim()) {
        if (requiredFields.tname ?? true) {
          errors.tname = "Team Name Required";
        }
      }
      if (!values.cname || !values.cname.trim()) {
        if (requiredFields.cname ?? true) {
          errors.cname = "Company Name Required";
        }
      }
      break;
    case "co_buyer":
      if (!values.cntm) {
        if (requiredFields.cntm ?? true) {
          errors.cntm = "Contact Method Required";
        }
      }
      break;
    case "appointment":
      if (!values.acti.wit && !isMessaging) {
        errors.wit = "Appointment With Required";
      }
      if (!values.acti.loc && !isMessaging) {
        errors.loc = "Location Required";
      }
      break;
    case "task":
      if (!values.acti.assi && !isMessaging) {
        errors.assi = "Assigned To Required";
      }
      break;
    case "email_template":
      if (!values.EmailTemplateRequest.HtmlPart) {
        errors.HtmlPart = "HTML Required";
      }
      if (!values.EmailTemplateRequest.Subject) {
        errors.Subject = "Subject Required";
      }
      if (!values.TemplateName) {
        errors.TemplateName = "Name Required";
      }
      if (values.TemplateName.trim().length > 80) {
        errors.TemplateName = "Length should be less than 80";
      }
      if (values.TemplateName.indexOf(" ") >= 0) {
        errors.TemplateName = "No Space Allowed";
      }
      if (!values.EmailTemplateRequest.TemplateDescription) {
        errors.TemplateDescription = "Description Required";
      }
      if (values.EmailTemplateRequest.TemplateDescription.trim().length > 500) {
        errors.TemplateDescription = "Length should be less than 500";
      }
      break;
    case "login":
      if (values.username.trim() === "") {
        errors.username = "Username Required";
      } else if (!validateEmail(values.username)) {
        errors.username = "Invalid Email address";
      }
      if (!values.password) {
        errors.password = "Password Required";
      }
      return errors;
    case "question":
      if (!values.qstn_text || values.qstn_text.trim() === "") {
        errors.qstn_text = "Question Required";
      }
      if (
        !values.qstn_options ||
        !Array.isArray(values.qstn_options) ||
        (Array.isArray(values.qstn_options) && values.qstn_options.length === 0)
      ) {
        errors.qstn_options = "Question Options Required";
      }
      if (
        !values.type ||
        !Array.isArray(values.type) ||
        (Array.isArray(values.type) && values.type.length === 0)
      ) {
        errors.type = "Types Required";
      }
      if (!values.qstn_type || values.qstn_type.trim() === "") {
        errors.qstn_type = "Question Type Required";
      }
      if (values.rel_id && values.rel_id !== "global") {
        if (
          !values.fltr_list ||
          !Array.isArray(values.fltr_list) ||
          (Array.isArray(values.fltr_list) && values.fltr_list.length === 0)
        ) {
          errors.fltr_list = "List Required";
        }
      }
      if (!values.hb_id || values.hb_id.trim() === "") {
        errors.hb_id = "Home Builder ID Required";
      }
      if (!values.rel_id || values.rel_id.trim() === "") {
        errors.rel_id = "Filter Type Required";
      }
      // if (!values.active || !(typeof values.active === 'boolean') || !(values.active instanceof Boolean)) {
      //     errors.active = 'Status Required';
      // }
      checkEmptyError();
      return errors;
    case "campaign":
      if (!values.acti.appid || values.acti.appid.trim() === "") {
        errors.appid = "App Id Required";
      }
      if (!values.acti.campid || values.acti.campid.trim() === "") {
        errors.campid = "Campaign/Journey Id Required";
      }
      if (!values.acti.segid || values.acti.segid.trim() === "") {
        errors.segid = "Segment Id Required";
      }
      if (!values.acti.campnm || values.acti.campnm.trim() === "") {
        errors.campnm = "Campaign/Journey Name Required";
      }
      if (!values.hb_id || values.hb_id.trim() === "") {
        errors.hb_id = "Home Builder ID Required";
      }
      checkEmptyError();
      return errors;
    default:
      checkEmptyError();
      return errors;
  }
  checkEmptyError();
  return errors;
};

export const validateFieldsRealtorBulk = (section, values, requiredFields = {}) => {
  console.log(`RequiredFields: ${JSON.stringify(requiredFields)}`);
  let errors = {};
  const checkEmptyError = () => {
    if (Object.keys(errors).length === 0) {
      errors = "";
    }
    // console.log('errors: ', errors);
  };
  console.log(`section: ${section}`);
  console.log("values: ", values);
  const fname = values.fname ? values.fname.trim() : "";
  const lname = values.lname ? values.lname.trim() : "";
  if (!fname) {
    if (requiredFields.fname ?? true) {
      errors.fname = "First Name Required";
    }
  }
  if (!lname) {
    if (requiredFields.lname ?? true) {
      errors.lname = "Last Name Required";
    }
  }

  // Check whether there are invalid characters in the name fields
  // if (containsInvalidCharacters(fname)) {
  //   errors.fname = "First name contains invalid characters";
  // }
  // if (containsInvalidCharacters(lname)) {
  //   errors.lname = "Last name contains invalid characters";
  // }
  if (fname.length > 50) {
    errors.fname = "Maximum length exceeds 50";
  }
  if (lname.length > 50) {
    errors.lname = "Maximum length exceeds 50";
  }

  if (!values.email) {
    if (requiredFields.email ?? true) {
      errors.email = "Email Required Required";
    }
  } else if (!validateEmail(values.email)) {
    errors.email = `Invalid Email Address`;
  }
  const isPhoneValid = validatePhone(values.phone);
  console.log(`isPhoneValid: ${isPhoneValid}`);
  if (!values.phone) {
    if (requiredFields.phone ?? true) {
      errors.phone = "Phone Required";
    }
  } else if (!isPhoneValid) {
    errors.phone = `Invalid Phone Number`;
  }
  if (!values.hb_id) {
    errors.hb_id = "Home Builder ID Required";
  }
  if (!values.psrc) {
    if (requiredFields.psrc ?? true) {
      errors.psrc = "Primary Source Required";
    }
  }
  if (!values.cntm) {
    if (requiredFields.cntm ?? true) {
      errors.cntm = "Contact Method Required";
    }
  }
  if (!values.agency_id) {
    if (requiredFields.agncy ?? true) {
      errors.agency_id = "Agency ID Required";
    }
  }
  checkEmptyError();
  return errors;
};

export const validateIdFieldsForAgency = async (data) => {
  try {
    const errors = [];
    const fields = [];

    if (data.agency) {
      // Validate the ids supplied in the request
      const params = {
        RequestItems: {
          /* required */
          [process.env.entitiesTableName]: {
            Keys: [],
            AttributesToGet: ["id", "entity"],
          },
        },
      };
      const hbId = data.agency.hb_id ? data.agency.hb_id.toString() : "";
      const metroIdList = data.agency.m_id
        ? checkAndRemoveDuplicateIds(data.agency.m_id)
        : [];
      const questions = data.agency.dgraph_list ? data.agency.dgraph_list : [];

      for (const metroId of metroIdList) {
        params.RequestItems[process.env.entitiesTableName].Keys.push({
          id: metroId.toString(),
          entity: `metro#${hbId}`,
        });
      }
      for (const question of questions) {
        params.RequestItems[process.env.entitiesTableName].Keys.push({
          id: question && question.qstn_id ? question.qstn_id.toString() : "",
          entity: `question#${hbId}#agency`,
        });
      }
      // console.log('params: ', JSON.stringify(params));
      const resourceValidationResponse = await batchGetResources(params, true);
      // console.log(`resourceValidationResponse: ${JSON.stringify(resourceValidationResponse)}`);
      const resourceValidationResp =
        resourceValidationResponse &&
          resourceValidationResponse.statusCode === 200 &&
          resourceValidationResponse.body
          ? JSON.parse(resourceValidationResponse.body)
          : [];
      // console.log(`resourceValidationResp: ${JSON.stringify(resourceValidationResp)}`);
      let validMetroIdList = false;
      for (const metroId of metroIdList) {
        validMetroIdList = validateId(metroId, resourceValidationResp, "metro");
        if (!validMetroIdList) {
          break;
        }
      }
      let validQuestion = false;
      for (const question of questions) {
        validQuestion = validateId(
          question && question.qstn_id ? question.qstn_id : "",
          resourceValidationResp, "question"
        );
        if (!validQuestion) {
          break;
        }
      }

      if (!validMetroIdList && metroIdList && metroIdList.length) {
        fields.push("metro");
        errors.push("metro field contains invalid value(s)");
      }
      if (!validQuestion && questions && questions.length) {
        fields.push("dgraph_list.qstn_id");
        errors.push("dgraph_list field contains invalid value(s) for qstn_id");
      }
    }

    if (data.broker) {
      // Validate the ids supplied in the request
      const params2 = {
        RequestItems: {
          /* required */
          [process.env.entitiesTableName]: {
            Keys: [],
            AttributesToGet: ["id", "entity"],
          },
        },
      };
      const hbId = data.broker.hb_id ? data.broker.hb_id.toString() : "";
      const specialityLists = data.broker.spec ? data.broker.spec : [];

      for (const specId of specialityLists) {
        params2.RequestItems[process.env.entitiesTableName].Keys.push({
          id: specId.toString(),
          entity: `spec#${hbId}`,
        });
      }

      // console.log('params2: ', JSON.stringify(params2));
      const resourceValidationResponse2 = await batchGetResources(
        params2,
        true
      );
      // console.log(`resourceValidationResponse2: ${JSON.stringify(resourceValidationResponse2)}`);
      const resourceValidationResp2 =
        resourceValidationResponse2 &&
          resourceValidationResponse2.statusCode === 200 &&
          resourceValidationResponse2.body
          ? JSON.parse(resourceValidationResponse2.body)
          : [];
      // console.log(`resourceValidationResp2: ${JSON.stringify(resourceValidationResp2)}`);
      let validSpecId = false;
      for (const specId of specialityLists) {
        validSpecId = validateId(specId, resourceValidationResp2, "spec");
        if (!validSpecId) {
          break;
        }
      }

      if (!validSpecId && specialityLists && specialityLists.length) {
        fields.push("spec");
        errors.push("spec field contains invalid value(s)");
      }
    }

    return { msg: errors, field: fields };
  } catch (error) {
    return { msg: [error], field: [] };
  }
};

// stage based trigger validations //
const salesStatusEnum = [
  "Lot",
  "Spec",
  "Model",
  "Committed",
  "Approved",
  "Revised",
  "Reserved",
];

const fail = (err) => ({ status: false, msg: err });

export const checkUniqueDynamo = async (id, hbid, type) => {
  try {
    const params = getParamsForQuery(
      {
        pathParameters: { id, hbid },
      },
      type
    );
    const result = await getResourceJSON(params);
    if (!result.length)
      return {
        status: false,
        msg: `This ${type} is not available in the system`,
      };
    return { status: true, result };
  } catch (error) {
    console.log("error in checkUniqueDynamo", JSON.stringify(error.stacks));
    return { status: false, msg: error.message };
  }
};

export const checkUniqueElastic = async (type, payload) => {
  try {
    const query = {
      httpMethod: "POST",
      requestPath: "/_count",
      payload: {
        query: {
          bool: {
            must: [],
          },
        },
      },
    };
    console.log(`Payload: ${JSON.stringify(payload)}`);
    if (payload.entity) {
      query.payload.query.bool.must.push({
        match: {
          "entity.keyword": payload.entity,
        },
      });
    }
    if (payload.number) {
      query.payload.query.bool.must.push({
        match: {
          "num.keyword": payload.number,
        },
      });
    }
    if (payload.name) {
      query.payload.query.bool.must.push({
        match: {
          "name.keyword": payload.name,
        },
      });
    }
    if (payload.id) {
      query.payload.query.bool.must_not = [
        {
          match: {
            "id.keyword": payload.id,
          },
        },
      ];
    }
    if (payload.sts) {
      query.payload.query.bool.must.push({
        match: {
          "sts.keyword": payload.sts,
        },
      });
    }
    if (payload.stage_id) {
      query.payload.query.bool.must.push({
        match: {
          "stage_id.keyword": payload.stage_id,
        },
      });
    }
    console.log(`query: ${JSON.stringify(query)}`);
    const count = await elasticExecuteQuery(query, true);

    console.log("count==>", count);

    if (!count.status)
      return { status: false, error: "Elastic count fetching Failed" };

    if (count?.body?.count)
      return {
        status: false,
        error: `This ${type} is used in the system`,
      };
    return { status: true };
  } catch (error) {
    console.log("error in checkUniqueElastic", JSON.stringify(error.stacks));
    return { status: false, error: error.message };
  }
};

export const validate = async (type, data, purpose) => {
  const result = {};
  if (purpose === "update") {
    if (!data.id) return fail("ID Required");

    const isIdValid = await checkUniqueDynamo(data.id, data.hb_id, type);

    if (!isIdValid.status) return fail(isIdValid.msg);

    if (!data.cdt) return fail("Created date Required");
  }
  if (!data.hb_id) return fail("Home Builder ID Required");

  if (!data.comm_id) return fail("Community ID Required");

  const isCommValid = await checkUniqueDynamo(
    data.comm_id,
    data.hb_id,
    "community"
  );

  if (!isCommValid.status) return fail(isCommValid.msg);

  if (isCommValid.result && isCommValid.result[0])
    result.comm = isCommValid.result[0].name;

  const name = data.name ? data.name.trim() : "";

  if (!name) return fail("Name Required");

  if (containsInvalidCharacters(name))
    return fail("Name contains invalid characters");

  if (!data.num) return fail(`${type} Number Required`);

  const isNumValid = await checkUniqueElastic(type, {
    entity: `${type}#${data.hb_id}`,
    number: data.num,
    id: purpose === "update" ? data.id : "",
  });

  if (!isNumValid.status) return fail(isNumValid.error);

  switch (type) {
    case "plan":
      break;
    case "lot":
      if (data.plan_id) {
        const isplanValid = await checkUniqueDynamo(
          data.plan_id,
          data.hb_id,
          "plan"
        );
        if (!isplanValid.status) return fail(isplanValid.msg);
        if (isplanValid.result && isplanValid.result[0])
          result.plan = isplanValid.result[0].name;
      }
      if (!data.sts) return fail("Sales Status Required");

      if (!salesStatusEnum.includes(data.sts))
        return fail("Invalid Sales Status");

      break;
    default: {
      return fail("Invalid Validation type");
    }
  }

  return { status: true, result };
};

// goal setting in dashboard validation

const recurEnum = ["NO", "DAY", "WEEK", "MONTH", "QUARTER", "YEAR"];

const isNumber = (value) => {
  if (typeof value !== "number") {
    return false;
  }

  if (value !== Number(value)) {
    return false;
  }
  if (value === Infinity || value === !Infinity) {
    return false;
  }
  return true;
};

export const validateGoal = async (data, purpose) => {
  if (purpose === "update") {
    if (!data.id) return fail("ID Required");
    const isIdValid = await checkUniqueDynamo(data.id, data.hb_id, "goal");
    if (!isIdValid.status) return fail(isIdValid.msg);
    if (!data.cdt) return fail("Created date Required");
  }

  const name = data.name ? data.name.trim() : "";
  if (!data.name) return fail("Goal Name is Required");
  if (containsInvalidCharacters(name))
    return fail("Name contains invalid characters");

  if (!data.hb_id) return fail("Home Builder ID Required");

  if (!data.comm_id) return fail("Community ID Required");
  const isCommValid = await checkUniqueDynamo(
    data.comm_id,
    data.hb_id,
    "community"
  );
  if (!isCommValid.status) return fail(isCommValid.msg);

  if (!data.recur || !recurEnum.includes(data.recur))
    return fail(
      `Recurring Value is Required and it must be any of the list ${recurEnum}`
    );

  if (!data.start_dt) return fail("Start Date is Required");
  if (!data.end_dt) return fail("End Date is Required");

  if (moment(data.start_dt, "DD-MM-YYYY") > moment(data.end_dt, "DD-MM-YYYY"))
    return fail("End date must always greater than or equal to start date");

  if (!data.stage) return fail("Stage is Required");
  if (!stages.includes(data.stage)) return fail("Invalid Stage");

  if (!data.goal) return fail("Goal is required");
  if (!isNumber(data?.goal)) return fail("Invalid goal");

  const isNameValid = await checkUniqueElastic("Goal Name", {
    entity: `goal#${data.hb_id}`,
    name: data.name,
    id: purpose === "update" ? data.id : "",
  });

  if (!isNameValid.status) return fail(isNameValid.error);

  return { status: true };
};


// check duplicated fields
export const isDuplicated = async ({ hbid = "", key = "name", val = "", entity = "", id = "" }) => {
  try {
    const query = [
      {
        match: {
          [`${key}.keyword`]: val
        }
      },
      {
        match: {
          'entity.keyword': `${entity}#${hbid}`
        }
      }
    ]
    const payloadData = {
      hb_id: hbid,
      customParams: query,
      isCustomParam: true,
    };
    const queryResponse = await doPaginatedQueryEllastic(payloadData);
    console.log(`queryResponse: ${JSON.stringify(queryResponse)}`);
    if (queryResponse.length && queryResponse[0].id !== id) throw "The given data already exists in the list";
    return {
      status: true,
      data: queryResponse
    };
  } catch (error) {
    console.log(`Error: ${JSON.stringify(error)}`);
    return {
      status: false,
      error: error?.message || error
    };
  };
};

async function customerFieldsLookup(entity, hbId) {
  try {

    const query = [];

    switch (entity) {
      case 'question':
        query.push(
          {
            match: {
              "entity.keyword": `${entity}#${hbId}#customer`
            }
          },
          {
            match: {
              "type.keyword": "question_customer"
            }
          }
        )
        break;
      default:
        query.push(
          {
            match: {
              "entity.keyword": `${entity}#${hbId}`
            }
          },
          {
            match: {
              "type.keyword": entity
            }
          }
        );
        break;
    };

    const payloadData = {
      hb_id: hbId,
      customParams: query,
      isCustomParam: true
    }
    console.log(`customerFieldsLookup :: payloadData :: ${JSON.stringify(payloadData)}`);
    const queryResponse = await doPaginatedQueryEllastic(payloadData);
    console.log(`customerFieldsLookup: ${JSON.stringify(queryResponse)}`);
    return { data: queryResponse, status: true };
  } catch (error) {
    console.log("error in customerFieldsLookup : ", error);
    return { status: false, error, data: [] };
  }
}

const cache = {};

async function memoFieldLookup(entity, hbId, callback) {
  console.log("In memoFieldLookup :: available cache ", JSON.stringify(cache));

  if (cache[`${hbId}#${entity}`]) {
    console.log("taken cached data");
    return { data: cache[`${hbId}#${entity}`], status: true };
  }
  const res = await callback(entity, hbId);
  console.log(`memoFieldLookup :: res :: ${JSON.stringify(res)}`);
  if (res.status) {
    cache[`${hbId}#${entity}`] = res.data;
  }
  return res;
};

export const validateFieldsV2 = async (section, values) => {
  const errors = {};
  const status = new Set();
  status.add(true);
  const { hb_id: hbId, fname, lname, stage,
    psrc: source, email, agent_email: agentEmail, grade,
    cntm, inte, infl, desf, phone, dg } = values;
  const data = {};

  let validCommunity = []

  switch (section) {
    case "customer":
      if (!fname.trim()) {
        status.add(false);
        errors.fname = `Invalid fname : "${fname}"`;
      } else if (fname.trim().length > 50) {
        status.add(false);
        errors.fname = `First Name maximum length exceeds 50`;
      } else {
        status.add(true);
      }
      if (!lname.trim()) {
        status.add(false);
        errors.lname = `Invalid lname : "${lname}"`;
      } else if (lname.trim().length > 50) {
        status.add(false);
        errors.lname = `Last Name maximum length exceeds 50`;
      } else {
        status.add(true);
      }
      if (phone) {
        const resp = validatePhone(phone, true);
        if (resp.isValid) {
          status.add(true)
          data.phone = resp.formattedNumber;
        } else {
          status.add(false);
          errors.phone = `Invalid Phone : "${phone}". ${resp.error}`;
          data.phone = "";
        }
      } else {
        status.add(false);
        errors.phone = `Invalid Phone : "${phone}"`;
        data.phone = "";
      }
      if (stage) {
        const validStages = ["lead", "prospect", "bust out", "dead lead", "closed", "buyer"];
        const stageMap = { "lead": "Lead", "prospect": "Prospect", "bust out": "Bust_Out", "closed": "Closed", "dead lead": "Dead_Lead", "buyer": "Buyer" };
        const stageKey = validStages.includes(stage.trim().toLowerCase()) ? stageMap[stage.trim().toLowerCase()] : undefined;
        console.log(`stageKey :: ${JSON.stringify(stageKey)}`);
        if (stageKey) {
          data.stage = stageKey;
          status.add(true);
        } else {
          errors.stage = `Invalid Stage : ${stage}`;
          status.add(false);
        }
      } else {
        errors.stage = `Invalid Stage : ${stage}`;
        status.add(false);
      }
      if (source) {
        const sourceResp = await memoFieldLookup("psrc", hbId, customerFieldsLookup);
        console.log(`sourceResp :: ${JSON.stringify(sourceResp)}`);
        if (sourceResp.status) {
          const filteredSource = sourceResp.data.filter(st => st.name.toLowerCase() === source.trim().toLowerCase())
          const sourceId = filteredSource.length ? filteredSource[0].id : undefined;
          if (!sourceId) {
            status.add(false);
            errors.psrc = `Invalid Source : ${source}`;
          }
          data.psrc = sourceId;
        } else {
          status.add(false);
          errors.psrc = `Invalid Source : ${source}`;
        }
      } else {
        status.add(false);
        errors.psrc = `Invalid Source : ${source}`;
      }
      if (email) {
        if (!validateEmail(email)) {
          status.add(false);
          errors.email = `Invalid Customer Email : ${email}`;
        }
      } else {
        status.add(false);
        errors.email = `Invalid Customer Email : ${email}`;
      }
      if (agentEmail) {
        if (!validateEmail(agentEmail)) {
          status.add(false);
          errors.email = `Invalid Agent Email : ${agentEmail}`;
        }
      }
      if (grade) {
        const gradeResp = await memoFieldLookup("grade", hbId, customerFieldsLookup);
        console.log(`gradeResp :: ${JSON.stringify(gradeResp)}`);
        if (gradeResp.status) {
          const filteredGrade = gradeResp.data.filter(st => st.name.toLowerCase() === grade.trim().toLowerCase())
          const gradeId = filteredGrade.length ? filteredGrade[0].id : undefined;
          if (!gradeId) {
            status.add(false);
            errors.grade = `Invalid grade : ${grade}`;
            data.grade = "";
          }
          data.grade = gradeId;
        } else {
          status.add(false)
          errors.grade = `Invalid Grade : ${grade}`;
          data.grade = "";
        }
      } else {
        status.add(false)
        errors.grade = `Invalid Grade : ${grade}`;
        data.grade = "";
      }
      if (cntm) {
        const cntmResp = await memoFieldLookup("cntm", hbId, customerFieldsLookup);
        console.log(`cntmResp :: ${JSON.stringify(cntmResp)}`);
        if (cntmResp.status) {
          const filteredcntm = cntmResp.data.filter(st => st.name.toLowerCase() === cntm.trim().toLowerCase())
          const cntmId = filteredcntm.length ? filteredcntm[0].id : undefined;
          if (!cntmId) {
            status.add(false);
            errors.contactMethod = `Invalid Contact Method : ${cntm}`;
            data.cntm = "";
          }
          data.cntm = cntmId;
        } else {
          status.add(false);
          errors.cntm = `Invalid Contact method : ${cntm}`;
          data.cntm = "";
        }
      } else {
        status.add(false);
        errors.cntm = `Invalid Contact method : ${cntm}`;
        data.cntm = "";
      }
      if (inte && inte.length) {
        const communityResp = await memoFieldLookup("community", hbId, customerFieldsLookup);
        console.log(`communityResp :: ${JSON.stringify(communityResp)}`);
        if (communityResp.status) {
          const validComms = [];
          const inValidComms = [];
          inte.forEach(c => {
            const filteredCommunity = communityResp.data.filter(comm => comm.name.toLowerCase() === c.trim().toLowerCase());

            if (filteredCommunity && filteredCommunity.length) {
              validComms.push(filteredCommunity[0].id);
            } else {
              inValidComms.push(c);
              status.add(false)
            }
          });
          if (inValidComms && inValidComms.length) { errors.inte = `Invalid community : ${inValidComms.join(', ')}`; }
          data.inte = validComms;
          validCommunity = validComms;
        }
      }
      if (infl && infl.length) {
        const inflResp = await memoFieldLookup("infl", hbId, customerFieldsLookup);
        console.log(`inflResp :: ${JSON.stringify(inflResp)}`);
        if (inflResp.status) {
          const validInfl = [];
          const inValidInfl = [];
          infl.forEach(c => {
            const filteredinfl = inflResp.data.filter(inf => inf.name.toLowerCase() === c.toLowerCase());
            if (filteredinfl && filteredinfl.length) {
              validInfl.push(filteredinfl[0].id);
            } else {
              inValidInfl.push(c);
              status.add(false)
            }
          });
          if (inValidInfl && inValidInfl.length) {
            errors.infl = `Invalid influence : ${inValidInfl.join(', ')}`;
          }
          data.infl = validInfl;
        }
      }
      if (desf && desf.length) {
        const desfResp = await memoFieldLookup("desf", hbId, customerFieldsLookup);
        console.log(`desfResp :: ${JSON.stringify(desfResp)}`);
        if (desfResp.status) {
          const validdesf = [];
          const inValiddesf = [];
          desf.forEach(c => {
            const filtereddesf = desfResp.data.filter(inf => inf.name.toLowerCase() === c.toLowerCase());
            if (filtereddesf && filtereddesf.length) {
              validdesf.push(filtereddesf[0].id);
            } else {
              inValiddesf.push(c);
              status.add(false)
            }
          });
          if (inValiddesf && inValiddesf.length) {
            errors.desf = `Invalid desired feature : ${inValiddesf.join(', ')}`;
          }
          data.desf = validdesf;
        }
      }
      if (dg && Object.keys(dg).length) {

        const dgResp = await memoFieldLookup('question', hbId, customerFieldsLookup);
        //debugger
        console.log(`dgResp: ${JSON.stringify(dgResp)}`);

        if (dgResp.status) {
          const validDg = [];
          const inValidDg = [];

          // looping through input dg
          for (let qn in dg) {
            const optns = dg[qn].split(',').map(opt => opt.trim().toLowerCase());
            let validOptions = [];
            if (!optns.length) {
              inValidDg.push({ [qn]: "No Options Provided." })
            } else {
              let alreadyInValidAddedFlag = false;

              const filteredDg = dgResp.data.find(eachDg => {

                //debugger
                console.log(`${eachDg.qstn_text.trim().toLowerCase()} ::::: ${qn.trim().toLowerCase()}`);

                if (eachDg.qstn_text.trim().toLowerCase() !== qn.trim().toLowerCase()) return false;

                // check the demographics is enabled or disabled
                if (!eachDg.active) {
                  inValidDg.push({ [qn]: dg[qn], error: "The Demogrpahics is disabled." })
                  alreadyInValidAddedFlag = true;
                  return false;
                }

                // make a flag for validDemographics
                let isValidDg = true;

                // check the assigned value of demographcis
                if (['community', 'metro'].includes(eachDg.rel_id)) {

                  let isSameCommOrMetro;

                  //debugger
                  console.log(`validCommunity: ${JSON.stringify(validCommunity)}`);

                  if (eachDg.rel_id === 'community') {
                    isSameCommOrMetro = validCommunity.some(eachComm => eachDg.fltr_list.includes(eachComm));
                  } else {

                    //debugger
                    console.log(`cache: ${JSON.stringify(cache)}`);

                    let filteredComm = cache[`${hbId}#community`].filter(eachComm => validCommunity.some(eachId => eachId === eachComm.id));

                    //debugger
                    console.log(`filteredComm: ${JSON.stringify(filteredComm)}`);

                    isSameCommOrMetro = filteredComm.some(eachMetro => eachDg.fltr_list.includes(eachMetro.rel_id));
                  }

                  //debugger
                  console.log(`isSameCommOrMetro: ${JSON.stringify(isSameCommOrMetro)}`);

                  // const isSameCommOrMetro = eachDg.rel_id === 'community'
                  //   ? validCommunity.some(eachComm => eachDg.fltr_list.includes(eachComm))
                  //   : cache.community.filter(eachComm => validCommunity.some(eachId => {
                  //     if (eachId === eachComm.id) {
                  //       return eachComm.rel;
                  //     }
                  //   })).some(eachMetro => eachDg.fltr_list.includes(eachMetro))

                  if (!isSameCommOrMetro) {
                    inValidDg.push({ [qn]: dg[qn], error: `The demographics is assigned to ${eachDg.rel_id} and the customer is not related to this ${eachDg.rel_id}.` });
                    alreadyInValidAddedFlag = true;
                    isValidDg = false;
                  };
                }

                if (isValidDg) {

                  //debugger
                  console.log(`Input Options: ${JSON.stringify(optns)}`);

                  validOptions = eachDg.qstn_options.filter(opt => optns.includes(opt.name.trim().toLowerCase()))

                  //debugger
                  console.log(`validOptions: ${JSON.stringify(validOptions)}`);

                  if (validOptions.length === optns.length) {

                    if (eachDg.qstn_type === 'dropdown' && validOptions.length > 1) {

                      inValidDg.push({ [qn]: dg[qn], error: "Type of this demographics is Single Select but You were given multiple Options." });
                      alreadyInValidAddedFlag = true;
                    } else {
                      return eachDg;
                    }
                  } else {
                    inValidDg.push({ [qn]: dg[qn], error: "The Options Contains Some Invalid Option" })
                    alreadyInValidAddedFlag = true;
                  };
                  return false;
                }
              });

              //debugger
              console.log(`filteredDg: ${JSON.stringify(filteredDg)}`);
              console.log(`validDg: ${JSON.stringify(validDg)}`);

              if (filteredDg) {
                const dgAlredyAdded = validDg.find(eachValidDg => eachValidDg.qstn_id === filteredDg.id);
                if (!dgAlredyAdded) {
                  validDg.push({ qstn_id: filteredDg.id, option_id: validOptions.map(eachOption => eachOption.id) })
                } else {
                  inValidDg.push({ [qn]: dg[qn], error: "Same Demographics exists." })
                }
              } else if (!alreadyInValidAddedFlag) {
                inValidDg.push({ [qn]: dg[qn] })
              };
            }
          };
          // if (inValidDg.length) {} errors.dg = `Invalid Demographics: ${JSON.stringify(inValidDg)}`;
          if (inValidDg.length) {
            const readableErrors = inValidDg.map(item => {
              const [question, answer] = Object.entries(item).find(([key]) => key !== 'error') || [];
              const error = item.error;

              return error
                ? `Question: "${question}"\nOptions: "${answer}"\nError: ${error}\n`
                : `Question: "${question}"\nOptions: "${answer}"\nError: Demographics Not Exists\n`;
            });

            // Join each formatted error with a line break
            const errorMessage = `Invalid Demographics:\n\n${readableErrors.join('\n')}`;
            console.log(errorMessage);
            errors.dg = errorMessage;
          }

          data.dgraph_list = validDg;
        }
      }
      break;
    default:
      break;
  }
  return { status: !status.has(false), errors, customer: data }
}
