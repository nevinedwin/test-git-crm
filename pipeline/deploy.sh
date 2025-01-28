#!/bin/bash

set -x
set -e

projectName="$1"
sourceBucket="$2"
cfResourceBucket="$3"
rootTemplate="$4"

allPackages() {
    while IFS= read -r -d '' item
    do 
        echo "$item" | base64
    done < <(allPackagesCmd)
}

allPackagesCmd() {
    (cd "$syncDir" && find * -name package.zip \
        -not -path "infrastructure/*" -printf "%h\0")
}

iterateTemplates() {
    allTemplates=()
    _iterateTemplates "$1"
}

_iterateTemplates() {
    local cwd=${1%/*template.yaml}
    local fileName=${1#"$cwd/"}
    local subStacks=$(cfn-flip "$1" | \
        jq -crM '.Resources[] | select(.Type == "AWS::CloudFormation::Stack") | .Properties.TemplateURL | @base64')
    for subStack in ${subStacks[@]}
    do
        
        subStack=$(echo $subStack | base64 -d)
        local subStackDir=${subStack%/*template.yaml}
        local subStackFile=${subStack#"$subStackDir/"}
        local subStackDir=$(cd "$cwd" && cd "$subStackDir" && pwd)
        _iterateTemplates "$subStackDir/$subStackFile"
    done
    allTemplates+=("$(echo ${cwd#"$syncDir/"}/$fileName | base64)")
}

baseDir="$(pwd)"
syncDir="$baseDir/sync/$projectName"

rm -rf $syncDir 2>/dev/null
aws s3 sync "s3://$sourceBucket/$projectName" "$syncDir"
allPackageDirs=($(allPackages))

for packageDir in ${allPackageDirs[@]}
do
    zipDir="$syncDir/$(echo $packageDir | base64 -d)"
    (cd "$zipDir" && unzip -q package.zip)
    rm "$zipDir/package.zip"
done

rootTemplateDir="$syncDir/infrastructure/$rootTemplate"
iterateTemplates $rootTemplateDir

for template in ${allTemplates[@]}
do
    template="$(echo $template | base64 -d)"
    templateDir=${template%/*template.yaml}
    templateFile=${template#"$templateDir/"}
    templateName=${templateFile%".yaml"}
    fullPath="$syncDir/$templateDir/$templateFile"
    aws cloudformation package --template-file "$fullPath" \
         --s3-bucket "$cfResourceBucket" --s3-prefix "$projectName/$templateDir/$templateName" \
         --output-template-file "$fullPath"
done

cp "$syncDir/infrastructure/$rootTemplate" "$baseDir/template.yaml"