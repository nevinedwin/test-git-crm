hyphenVersionKey="hyphen:versionHash"

# Initialize an empty JSON object 
_initializeJsonObj() {
    echo '{}' | jq --arg key "$1" -crM '. + {($key): []}'
}

# Retrieves the top level key of the updates structure passed in
_getKey() {
    echo "$1" | jq -crM 'keys[0]'
}

# Returns the key used to determine the package or template name
# used to add changed elements to the JSON structure, 
# will return either Service or Template
_getItemKey() {
    itemKey=$(_getKey "$1")
    echo ${itemKey%sUpdated} 
}

# Adds a package or template to the passed in JSON structure
# along with the newly caclulated version of the package
# or template
_addChange() {
    itemKey=$(_getItemKey "$1")
    key=$(_getKey "$1")
    echo "$1" | jq  -crM --arg itemKey "$itemKey" --arg key "$key" --arg item "$2" --arg version "$3" \
        '.[($key)] += [{($itemKey): $item, "Version": $version}]'
}

# Used to detect changes to specific services and templates within the project
# Calculates a SHA1 hash to determine whether or not a
# specific template or package has changed
_getUpdatedItems() {
    servicesUpdated=$(_initializeJsonObj "$1")
    # services=$("$2")
    # for service in ${services[@]}
    # do
        service="front_end"
        deployedVersion=$(_getDeployedVersion "$service/package.zip")
        currentVersion=$("$3" "$service")
        # if [[ "$deployedVersion" != "$currentVersion" ]]; then
        servicesUpdated=$(_addChange "$servicesUpdated" "$service" "$currentVersion")
        # fi
    # done
    echo $servicesUpdated | jq -crM '.'
}

# Uses AWS S3 CLI to retrieve the tags for the packaged 
# version of the service or template that resides on S3
# $1 package or service zip relative to project root.
# This method is used by getDeployedVersion function
_getObjectTags() {
    aws s3api get-object-tagging --bucket "$envBucket" --key "$appName/$1" --output json 2>/dev/null
}

# Retrieves all tags, then filters to retrieve
# the SHA1 hash of the package or template. 
# Returns pacakged version
# $1 S3 key, not inclusive of the application name
_getDeployedVersion() {
    tagSet=$(_getObjectTags "$1" || echo '{"TagSet":[]}')
    echo "$tagSet"| jq -crM --arg versionKey "$hyphenVersionKey" \
        '.TagSet | map({(.Key): .Value}) | reduce .[] as $i ({}; . + $i) | .[($versionKey)]'
}

# Base64 encodes what is sent to it
# $1 string to encode
encode() {
    echo "$1" | base64
}

# Base64 decodes what is sent to it
# string to decode
decode() {
    echo "$1" | base64 -d
}

# Executes a bash command that generates a null byte separated bash
# array and returns a base64 encoded space separated bash array
# $1 bash command that generates a null byte separated bash string
_createEncodedArray() {
    echo "serviceFiles: $1"
    while IFS= read -r -d '' item
    do 
        encode "$item"
    done < <("$1")
}

# Used to find all service packages within a repository. A service
# is defined by a directory that has a package.json file in its 
# directory. This single package is placed on a lambda and can 
# be deployed individually. This function is passed to the 
# _createEncodedArray function
_allServicesCmd() {
    (cd "$azureRootDir" && find * -name package.json \
        -not -path "infrastructure/*" -not -path "*/node_modules/*" \
        -not -path "azure-pipeline/*" \
        -not -path "resources/sdklayer/*" \
        -not -path "POC/*" \
        -not -path "pipeline_frontend/*" \
        -not -path "QA_Automation/*" \
        -not -path "resources/src/*" \
        -not -path "back_end/*" \
        -not -path "*/.aws-sam/*" -printf "%h\0")
}

allServices() {
    _createEncodedArray _allServicesCmd
}

# Calculates the current SHA1 hash version number
# of the passed in service. This is used in order to 
# determine if a service has changed and needs to be
# pacakged and sent to S3. 
# Steps:
# 1. Each file in the service package is found
# 2. The contents of each file is SHA1 encoded
# 3. The contents hash is prepended with the 
#    file name and new line
# 4. The updated contents is SHA1 hashed, creating 
#    a representative hash of the file
# 5. The representative hash and a new line is appended 
#    to a running list of all hashes of files in directory
# 6. After all file hashes are appended, the file list
#    is hashed, creating a version number for service directory
# $1 path to directory to calculate version
_packageVersion() {
    _setServiceDirectory "$1"
    files=$(_createEncodedArray _serviceFiles)
    for file in ${files[@]}
    do
        file=$(decode $file)
        contents=$(_hashFile "$1/$file")
        contents="$file\n$contents"
        contents=$(_hash "$contents")
        packages+="$contents\n"
    done
    echo $(_hash "$packages")
}

# Used in conjunction with _serviceFiles function.
# This function is used to set the serviceDirectory 
# variable used by the _serviceFiles method
# $1 service dir relative to project root
_setServiceDirectory() {
    serviceDirectory="$1"
}

# Returns SHA1 hash of string passed
# $1 string to SHA1 encode
_hash() {
    echo "$1" | sha1sum | awk '{print $1}'
}

# Returns SHA1 hash of file passed
# $1 path to SHA1 encode relative to root dir
_hashFile() {
    sha1sum "$azureRootDir/$1" | awk '{print $1}'
}

# Function that contains commands used to generate a null
# byte character separated array of all of the files in a 
# service directory. This function is passed to the 
# _createEncodedArray function
_serviceFiles() {
    (cd "$azureRootDir/$serviceDirectory" && \
        find * -type f -not -path "node_modules/*" -not -path ".build/*" -print0 | sort -z)
}

# Used to detect changes to specific services within the project
# The SHA1 version of all of the services are calculated, and if
# any are different than what is tagged on the current deployed 
# version on S3, the service path and version is added to a list
# to be updated
getUpdatedServices() {
    _getUpdatedItems 'ServicesUpdated' allServices _packageVersion
}

servicesUpdated=$(getUpdatedServices)
echo $servicesUpdated | jq -rM '.'
echo "##vso[task.setvariable variable=servicesUpdated]$servicesUpdated"

# source "$azureRootDir/azure_pipeline/shared/services.sh"

# servicesUpdated=$(getUpdatedServices)
# echo $servicesUpdated | jq -rM '.'
# echo "##vso[task.setvariable variable=servicesUpdated]$servicesUpdated"