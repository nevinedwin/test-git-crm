"use strict";
var __assign =
  (this && this.__assign) ||
  function () {
    __assign =
      Object.assign ||
      function (t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
          s = arguments[i];
          for (var p in s)
            if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
        }
        return t;
      };
    return __assign.apply(this, arguments);
  };
var __importStar =
  (this && this.__importStar) ||
  function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null)
      for (var k in mod)
        if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
  };
var fs = __importStar(require("fs"));
var path = __importStar(require("path"));
var yaml_cfn_1 = require("yaml-cfn");
var AwsSamPlugin = /** @class */ (function () {
  function AwsSamPlugin(options) {
    this.entryPoints = {};
    this.options = __assign(
      { projects: { default: "." }, vscodeDebug: true },
      options
    );
    this.samConfigs = [];
  }
  // Returns the name of the SAM template file or null if it's not found
  AwsSamPlugin.prototype.templateName = function (prefix) {
    for (var _i = 0, _a = AwsSamPlugin.defaultTemplates; _i < _a.length; _i++) {
      var f = _a[_i];
      var template = prefix + "/" + f;
      if (fs.existsSync(template)) {
        return template;
      }
    }
    return null;
  };
  // Returns a webpack entry object based on the SAM template
  AwsSamPlugin.prototype.entryFor = function (projectKey, projectTemplate) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
    var samConfig = yaml_cfn_1.yamlParse(
      fs.readFileSync(projectTemplate).toString()
    );
    var defaultRuntime =
      (_c =
        (_b =
          (_a = samConfig.Globals) === null || _a === void 0
            ? void 0
            : _a.Function) === null || _b === void 0
          ? void 0
          : _b.Runtime) !== null && _c !== void 0
        ? _c
        : null;
    var defaultHandler =
      (_f =
        (_e =
          (_d = samConfig.Globals) === null || _d === void 0
            ? void 0
            : _d.Function) === null || _e === void 0
          ? void 0
          : _e.Handler) !== null && _f !== void 0
        ? _f
        : null;
    var defaultCodeUri =
      (_j =
        (_h =
          (_g = samConfig.Globals) === null || _g === void 0
            ? void 0
            : _g.Function) === null || _h === void 0
          ? void 0
          : _h.CodeUri) !== null && _j !== void 0
        ? _j
        : null;
    // Loop through all of the resources
    for (var resourceKey in samConfig.Resources) {
      var resource = samConfig.Resources[resourceKey];
      // Find all of the functions
      if (resource.Type === "AWS::Serverless::Function") {
        var properties = resource.Properties;
        if (!properties) {
          throw new Error(resourceKey + " is missing Properties");
        }
        // Check the runtime is supported
        if (
          !["nodejs12.x", "nodejs14.x", "nodejs16.x", "nodejs20.x"].includes(
            (_k = properties.Runtime) !== null && _k !== void 0
              ? _k
              : defaultRuntime
          )
        ) {
          throw new Error(
            resourceKey +
              " has an unsupport Runtime. Must be nodejs12.x, nodejs14.x, nodejs14.x, or nodejs20.x"
          );
        }
        // Continue with a warning if they're using inline code
        if (properties.InlineCode) {
          console.log(
            "WARNING: This plugin does not compile inline code. The InlineCode for '" +
              resourceKey +
              "' will be copied 'as is'."
          );
          continue;
        }
        // Check we have a valid handler
        var handler =
          (_l = properties.Handler) !== null && _l !== void 0
            ? _l
            : defaultHandler;
        if (!handler) {
          throw new Error(resourceKey + " is missing a Handler");
        }
        var handlerComponents = handler.split(".");
        if (handlerComponents.length !== 2) {
          throw new Error(
            resourceKey + ' Handler must contain exactly one "."'
          );
        }
        // Check we have a CodeUri
        var codeUri =
          (_m = properties.CodeUri) !== null && _m !== void 0
            ? _m
            : defaultCodeUri;
        if (!codeUri) {
          throw new Error(resourceKey + " is missing a CodeUri");
        }
        var projectPath = path.relative(".", path.dirname(projectTemplate));
        var basePath = codeUri
          ? "./" + projectPath + "/" + codeUri
          : "./" + projectPath;
        var fileBase = basePath + "/" + handlerComponents[0];
        // var buildRoot = projectPath === "" ? ".aws-sam/build" : projectPath + "/.aws-sam/build";
        // var buildRoot = projectPath === "" ? ".aws-sam/build" : projectPath + "/.aws-sam/build";
        var buildRoot = "../" + projectPath;
        // var buildRoot = projectPath + "_Build";
        // Generate the launch config for the VS Code debugger
        this.launchConfig.configurations.push({
          name:
            projectKey === "default"
              ? resourceKey
              : projectKey + ":" + resourceKey,
          type: "node",
          request: "attach",
          address: "localhost",
          port: 5858,
          localRoot: "${workspaceRoot}/" + buildRoot + "/" + resourceKey,
          remoteRoot: "/var/task",
          protocol: "inspector",
          stopOnEntry: false,
          outFiles: [
            "${workspaceRoot}/" + buildRoot + "/" + resourceKey + "/app.js",
          ],
          sourceMaps: true,
        });
        // Add the entry point for webpack
        var entryPointName =
          projectKey === "default"
            ? resourceKey
            : projectKey + "#" + resourceKey;
        this.entryPoints[entryPointName] = fileBase;
        samConfig.Resources[resourceKey].Properties.CodeUri =
          buildRoot + "/" + resourceKey;
        // samConfig.Resources[resourceKey].Properties.CodeUri = resourceKey;
        // console.log(`resourceKey: ${resourceKey}`);
        // console.log(`buildRoot: ${buildRoot}`);
        samConfig.Resources[resourceKey].Properties.Handler =
          "app." + handlerComponents[1];
        this.samConfigs.push({
          buildRoot: buildRoot,
          entryPointName: entryPointName,
          outFile: "./" + buildRoot + "/" + resourceKey + "/app.js",
          projectKey: projectKey,
          samConfig: samConfig,
        });
      }
    }
  };
  AwsSamPlugin.prototype.entry = function () {
    // Reset the entry points and launch config
    this.entryPoints = {};
    this.launchConfig = {
      version: "0.2.0",
      configurations: [],
    };
    this.samConfigs = [];
    for (var projectKey in this.options.projects) {
      var projectTemplate = this.options.projects[projectKey];
      var template = fs.statSync(projectTemplate).isFile()
        ? projectTemplate
        : this.templateName(fs.realpathSync(projectTemplate));
      if (template === null) {
        // This works because only this.templateName() should return null
        throw new Error(
          "Could not find " +
            AwsSamPlugin.defaultTemplates.join(" or ") +
            " in " +
            projectTemplate
        );
      }
      this.entryFor(projectKey, template);
    }
    return this.entryPoints;
  };
  AwsSamPlugin.prototype.filename = function (chunkData) {
    var samConfig = this.samConfigs.find(function (c) {
      return c.entryPointName === chunkData.chunk.name;
    });
    if (!samConfig) {
      throw new Error("Unable to find filename for " + chunkData.chunk.name);
    }
    return samConfig.outFile;
  };
  AwsSamPlugin.prototype.apply = function (compiler) {
    var _this = this;
    compiler.hooks.afterEmit.tap("SamPlugin", function (_compilation) {
      if (_this.samConfigs && _this.launchConfig) {
        for (var _i = 0, _a = _this.samConfigs; _i < _a.length; _i++) {
          var samConfig = _a[_i];
          if (!fs.existsSync("../infrastructure")) {
            fs.mkdirSync("../infrastructure");
          }
          fs.writeFileSync(
            "../infrastructure/" + samConfig.projectKey + "-template.yaml",
            yaml_cfn_1.yamlDump(samConfig.samConfig)
          );
        }
        if (_this.options.vscodeDebug) {
          if (!fs.existsSync(".vscode")) {
            fs.mkdirSync(".vscode");
          }
          fs.writeFileSync(
            ".vscode/launch.json",
            JSON.stringify(_this.launchConfig, null, 2)
          );
        }
      } else {
        console.log("It looks like SamPlugin.entry() was not called");
      }
    });
  };
  AwsSamPlugin.defaultTemplates = ["template.yaml", "template.yml"];
  return AwsSamPlugin;
})();
module.exports = AwsSamPlugin;
