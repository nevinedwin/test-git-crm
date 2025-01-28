hyphenVersionKey="hyphen:versionHash"

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

iterateChanges() {
    itemKey=$(_getItemKey "$1")
    key=$(_getKey "$1")
    echo "$1" | jq -crM --arg itemKey "$itemKey" --arg key "$key" \
        '.[($key)] | map(.[($itemKey)] | @base64) | .[]'
}

iterateVersionedChanges() {
    itemKey=$(_getItemKey "$1")
    key=$(_getKey "$1")
    echo "$1" | jq -crM --arg itemKey "$itemKey" --arg key "$key" \
        '.[($key)] | map(((.[($itemKey)] | @base64) + " "  + .Version)) | .[] | @base64'
}

# PRIVATE ##########################################################################

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

# Executes a bash command that generates a null byte separated bash
# array and returns a base64 encoded space separated bash array
# $1 bash command that generates a null byte separated bash string
_createEncodedArray() {
    while IFS= read -r -d '' item
    do 
        encode "$item"
    done < <("$1")
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
    services=$("$2")
    for service in ${services[@]}
    do
        service=$(decode "$service")
        deployedVersion=$(_getDeployedVersion "$service/package.zip")
        currentVersion=$("$3" "$service")
        if [[ "$deployedVersion" != "$currentVersion" ]]; then
            servicesUpdated=$(_addChange "$servicesUpdated" "$service" "$currentVersion")
        fi
    done
    echo $servicesUpdated | jq -crM '.'
}