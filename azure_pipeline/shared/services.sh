source "$azureRootDir/azure_pipeline/shared/scripts.sh"

# Used to find all service packages within a repository. A service
# is defined by a directory that has a package.json file in its 
# directory. This single package is placed on a lambda and can 
# be deployed individually. This function is passed to the 
# _createEncodedArray function
allServices() {
    _createEncodedArray _allServicesCmd
}

# Used to detect changes to specific services within the project
# The SHA1 version of all of the services are calculated, and if
# any are different than what is tagged on the current deployed 
# version on S3, the service path and version is added to a list
# to be updated
getUpdatedServices() {
    _getUpdatedItems 'ServicesUpdated' allServices _packageVersion
}

# Creates a zip package of the passed in services and places
# on S3 to be deployed.
# Steps: 
# 1. First deletes any zip package that may already exist,
#    and then creates directory if neccessary
# 2. Zip is created of service files
# 3. Zip is placed on S3 at specific location, and 
#    tags are added that define the version of the package
# $1 service dir relative to project root
# $2 SHA1 version of the current service
packageService() {
    packageDir="/tmp/hyphen/$1"
    packageFile="$packageDir/package.zip"
    rm $packageFile 2>/dev/null || mkdir -p "$packageDir"
    metadata=$(echo '{}' | jq -r --arg gitHash "$gitHash"  '. |= {"gitHash": $gitHash}' )
    (cd "$azureRootDir/$1" && echo "$metadata" > metadata.json)
    (cd "$azureRootDir/$1" && zip "$packageFile" -q -r \
        --exclude="*template.yaml" --exclude=".aws-sam/*"\
        --exclude="*readme*" --exclude="package*.json" ./)
    aws s3api put-object --key "$appName/$1/package.zip" --bucket "$envBucket" \
        --body "$packageFile" --tagging "$hyphenVersionKey=$2"
}

# PRIVATE ##########################################################################

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

# Function that contains commands used to generate a null
# byte character separated array of all of the files in a 
# service directory. This function is passed to the 
# _createEncodedArray function
_serviceFiles() {
    (cd "$azureRootDir/$serviceDirectory" && \
        find * -type f -not -path "node_modules/*" \
            -not -path "azure-pipeline/*" \
            -not -path ".aws-sam/*" -print0 | sort -z)
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
        -not -path "POC/*" \
        -not -path "pipeline_frontend/*" \
        -not -path "QA_Automation/*" \
        -not -path "front_end/*" \
        -not -path "back_end/*" \
        -not -path "*/.aws-sam/*" -printf "%h\0")
}