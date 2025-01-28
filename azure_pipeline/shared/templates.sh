source "$azureRootDir/azure_pipeline/shared/scripts.sh"

# returns an array of base64 encoded items
# represeting the templates found in the project
allTemplates() {
    _createEncodedArray _allTemplatesCmd
}

# Upoloads template on S3 at specific location, and 
# tags are added that define the version of the template
# $1 service dir relative to project root
# $2 SHA1 version of the current service
packageTemplate() {
    templateDir="/tmp/hyphen/$1"
    templateFile="/tmp/hyphen/$1/template.yaml"
    rm $templateFile 2>/dev/null || mkdir -p "$templateDir"
    jsonTemplate=$(cfn-flip -j "$azureRootDir/$1")
    jsonTemplate=$(echo "$jsonTemplate" | jq -r --arg gitHash "$gitHash" \
        'to_entries | [{"key": "Metadata", "value": {"GitHash": $gitHash}}]  + . | from_entries')
    echo "$jsonTemplate" | cfn-flip -y > "$templateFile"
    aws s3api put-object --key "$appName/$1" --bucket "$envBucket" \
        --body "$templateFile" --tagging "hyphen:versionHash=$2"
}

# Gets an array of the filenames and paths of all of the 
# CloudFormation templates that have been updated in the project
# In the infrastructure directory
getUpdatedTemplates() {
    _getUpdatedItems 'TemplatesUpdated' allTemplates _templateVersion
}

# PRIVATE ##########################################################################

# Returns a SHA1 encoded version
# of the current template on S3
_templateVersion() {
    contents=$(_hashFile "$1")
    contents="$1\n$contents"
    echo $(_hash "$contents")
}

# Command used to create a list of all templates
# located in the infrastructure directory in the project
_allTemplatesCmd() {
    (cd "$azureRootDir" && find * -path 'infrastructure/*' \
        -not -path "azure-pipeline/*" -name "*template.yaml" -print0)
}