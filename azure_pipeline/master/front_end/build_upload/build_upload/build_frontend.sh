source "$azureRootDir/azure_pipeline/shared/scripts.sh"

for service in $(iterateVersionedChanges "$servicesUpdated")
do
    service=($(decode $service))
    version="${service[1]}"
    service=$(decode "${service[0]}")
    echo "Installing packages for $service..."
    (cd "$azureRootDir" && npm --no-package-lock --prefix "$service" install --legacy-peer-deps && npm --prefix "$service" run preprod-deploy)
    echo "Installation completed for $service...\n"
    packageDir="/tmp/hyphen/$service"
    packageFile="$packageDir/package.zip"
    rm $packageFile 2>/dev/null || mkdir -p "$packageDir"
    metadata=$(echo '{}' | jq -r --arg gitHash "$gitHash"  '. |= {"gitHash": $gitHash}' )
    # (cd "$azureRootDir" && npm --no-package-lock --prefix "$service" install --legacy-peer-deps && npm --prefix "$service" run preprod-deploy)
    echo "Build completed for $service..."
    (cd "$azureRootDir/$service/build" && echo "$metadata" > metadata.json)
    echo "Metadata creation completed for $service"
    (cd "$azureRootDir/$service/build" && zip "$packageFile" -q -r ./)
    echo "Zipping completed for $service..."
    aws s3api put-object --key "$appName/$service/package.zip" --bucket "$envBucket" \
        --body "$packageFile" --tagging "$hyphenVersionKey=$version"
    echo "Upload completed for $service..."
done
# service=$(iterateVersionedChanges "$servicesUpdated")
# service=($(decode $service))
# version="${service[1]}"
# service=$(decode "${service[0]}")
# echo "Installing packages for $service..."
# (cd "$azureRootDir" && npm --no-package-lock --prefix "$service" install)
# echo "Installation completed for $service...\n"
# packageDir="/tmp/hyphen/$service"
# packageFile="$packageDir/package.zip"
# rm $packageFile 2>/dev/null || mkdir -p "$packageDir"
# metadata=$(echo '{}' | jq -r --arg gitHash "$gitHash"  '. |= {"gitHash": $gitHash}' )
# (cd "$azureRootDir" && npm i && npm --prefix "$service" run preprod-deploy)
# echo "Build completed for $service..."
# (cd "$azureRootDir/$service/build" && echo "$metadata" > metadata.json)
# echo "Metadata creation completed for $service"
# (cd "$azureRootDir/$service/build" && zip "$packageFile" -q -r ./)
# echo "Zipping completed for $service..."
# aws s3api put-object --key "$appName/$service/package.zip" --bucket "$envBucket" \
#     --body "$packageFile" --tagging "$hyphenVersionKey=$version"
# echo "Upload completed for $service..."
